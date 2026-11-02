import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { crearCampana, enviarPrueba, procesarCola, type TipoCampana } from '@/lib/newsletter/campanas';

/**
 * Cron de la newsletter (docs/tecnico/newsletter.md, N1). Lo llaman los
 * schedules de Dokploy con `Authorization: Bearer $NEWSLETTER_CRON_SECRET`
 * (o, si no existe, el mismo secreto de los crons de auditoría):
 *
 *   ?paso=inicio         días 1-10: crea la campaña del mes en cuanto la encuesta está abierta
 *   ?paso=recordatorio   día 25: crea el recordatorio para quien no ha terminado
 *   ?paso=cola           cada hora: envía lo pendiente sin pasar del cupo diario
 *   ?paso=prueba&tipo=…&para=…   un correo de prueba a esa dirección
 *
 * `inicio` y `recordatorio` vacían la cola a continuación. Crear dos veces la
 * misma campaña no duplica nada (única por tipo y mes).
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function autorizado(req: Request): boolean {
  const esperado = (process.env.NEWSLETTER_CRON_SECRET || process.env.VIGIA_INGEST_SECRET)?.trim();
  if (!esperado) return false;
  const recibido = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!autorizado(req)) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const p = new URL(req.url).searchParams;
  const paso = p.get('paso') ?? 'cola';
  const admin = createAdminClient();

  if (paso === 'prueba') {
    const para = p.get('para') ?? '';
    const tipo: TipoCampana = p.get('tipo') === 'recordatorio' ? 'encuesta_recordatorio' : 'encuesta_inicio';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(para)) return NextResponse.json({ error: 'para= no válido' }, { status: 400 });
    return NextResponse.json(await enviarPrueba(admin, tipo, para));
  }

  let campana = null;
  if (paso === 'inicio' || paso === 'recordatorio') {
    campana = await crearCampana(admin, paso === 'inicio' ? 'encuesta_inicio' : 'encuesta_recordatorio');
  } else if (paso !== 'cola') {
    return NextResponse.json({ error: 'paso = inicio | recordatorio | cola | prueba' }, { status: 400 });
  }
  const cola = await procesarCola(admin);
  return NextResponse.json({ ok: true, campana, cola });
}
