import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { timingSafeEqual } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { stripeCliente } from '@/lib/stripe/servidor';

/**
 * Sincronización diaria de Stripe → `finance_stripe_monthly` (migración 0060).
 *
 * La dispara un cron (n8n, una vez al día) con `Authorization: Bearer
 * $CUENTAS_SYNC_SECRET`. Se recalculan los últimos 13 meses enteros desde
 * `balance_transactions`, así que es idempotente: repetirla no duplica nada y
 * una devolución tardía corrige el mes que le toca.
 *
 * Solo agrega importes y cuenta cobros. No lee ni guarda nada de clientes.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const MESES_ATRAS = 13;

function autorizado(req: Request): boolean {
  const esperado = process.env.CUENTAS_SYNC_SECRET?.trim();
  if (!esperado) return false;
  const recibido = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Clave 'YYYY-MM-01' del mes en Europe/Madrid. */
function mesMadrid(epochSeg: number): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date(epochSeg * 1000));
  return `${partes}-01`; // en-CA => "2026-10"
}

type Acum = { gross: number; fee: number; refund: number; n: number };

async function sincronizar() {
  const stripe = await stripeCliente();
  const admin = createAdminClient();

  const desde = new Date();
  desde.setUTCMonth(desde.getUTCMonth() - MESES_ATRAS);
  desde.setUTCDate(1);
  desde.setUTCHours(0, 0, 0, 0);

  const meses = new Map<string, Acum>();
  const de = (m: string) => {
    let a = meses.get(m);
    if (!a) meses.set(m, (a = { gross: 0, fee: 0, refund: 0, n: 0 }));
    return a;
  };

  for await (const bt of stripe.balanceTransactions.list({
    created: { gte: Math.floor(desde.getTime() / 1000) },
    limit: 100,
  })) {
    if (bt.currency !== 'eur') continue;
    const acum = de(mesMadrid(bt.created));
    if (bt.type === 'charge' || bt.type === 'payment') {
      acum.gross += bt.amount;
      acum.fee += bt.fee;
      acum.n += 1;
    } else if (bt.type === 'refund' || bt.type === 'payment_refund') {
      acum.refund += -bt.amount; // viene negativo
      acum.fee += bt.fee;
    }
    // payout, adjustment, stripe_fee suelto…: no son ingresos del partido.
  }

  const { count: sociosActivos } = await admin
    .from('members')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active');

  const mesActual = mesMadrid(Math.floor(Date.now() / 1000));
  de(mesActual); // el mes en curso aparece aunque aún no haya cobros

  const filas = [...meses.entries()].map(([month, a]) => ({
    month,
    gross_cents: a.gross,
    fee_cents: a.fee,
    refund_cents: a.refund,
    charges_count: a.n,
    members_active: month === mesActual ? (sociosActivos ?? 0) : null,
    synced_at: new Date().toISOString(),
  }));

  const { error } = await admin.from('finance_stripe_monthly').upsert(filas, { onConflict: 'month' });
  if (error) throw new Error(`upsert finance_stripe_monthly: ${error.message}`);

  revalidatePath('/cuentas');
  return { meses: filas.length, sociosActivos: sociosActivos ?? 0 };
}

async function manejar(req: Request) {
  if (!autorizado(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...(await sincronizar()) });
  } catch (e) {
    console.error('[cuentas/sync]', e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}

export const GET = manejar;
export const POST = manejar;
