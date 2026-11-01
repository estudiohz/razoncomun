import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { indexarDiaBoe } from '@/lib/vigia/boe';

/**
 * Índice diario del BOE (0076). Lo llama un schedule de Dokploy cada mañana:
 * `POST /api/auditoria/indexar-boe` con `Authorization: Bearer $VIGIA_INGEST_SECRET`.
 *
 * Sin parámetros indexa los últimos 3 días (por si un día falló). Para cargar
 * el histórico: `?desde=2025-01-01&dias=31` — se procesa día a día, como
 * máximo 62 por llamada, para no saturar al BOE ni pasar el tiempo límite.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function autorizado(req: Request): boolean {
  const esperado = process.env.VIGIA_INGEST_SECRET?.trim();
  if (!esperado) return false;
  const recibido = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

const aAAAAMMDD = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');

export async function POST(req: Request) {
  if (!autorizado(req)) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const dias = Math.min(62, Math.max(1, Number(params.get('dias') ?? 3) || 3));
  const desdeParam = params.get('desde');
  let inicio: Date;
  if (desdeParam) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(desdeParam)) return NextResponse.json({ error: 'desde = AAAA-MM-DD' }, { status: 400 });
    inicio = new Date(`${desdeParam}T12:00:00Z`);
  } else {
    inicio = new Date(Date.now() - (dias - 1) * 86_400_000);
  }

  const admin = createAdminClient();
  const resultado: Record<string, number | string> = {};
  for (let i = 0; i < dias; i++) {
    const d = new Date(inicio.getTime() + i * 86_400_000);
    if (d.getTime() > Date.now()) break;
    const fecha = aAAAAMMDD(d);
    try {
      resultado[fecha] = await indexarDiaBoe(admin, fecha);
    } catch (e) {
      resultado[fecha] = `error: ${e instanceof Error ? e.message : e}`;
    }
  }
  const total = Object.values(resultado).reduce<number>((s, v) => s + (typeof v === 'number' ? v : 0), 0);
  return NextResponse.json({ ok: true, total, dias: resultado });
}
