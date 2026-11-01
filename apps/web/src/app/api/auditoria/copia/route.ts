import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { guardarBytes } from '@/lib/vigia/copias';

/**
 * Copia de respaldo del vídeo de un reel (0074). La sube el bot de n8n justo
 * después de abrir el caso: n8n ya descarga el reel con yt-dlp para
 * transcribirlo, así que guarda también el vídeo por si el reel desaparece.
 *
 * `POST /api/auditoria/copia?caso_id=…&url=…` con el vídeo como cuerpo
 * (`content-type: video/mp4`) y `Authorization: Bearer $VIGIA_INGEST_SECRET`.
 * El archivo va al bucket privado `vigia-pruebas`; nunca se publica (M9: no
 * se resube el vídeo de terceros, se guarda como prueba).
 */
export const dynamic = 'force-dynamic';

const MAX_BYTES = 100 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function autorizado(req: Request): boolean {
  const esperado = process.env.VIGIA_INGEST_SECRET?.trim();
  if (!esperado) return false;
  const recibido = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!autorizado(req)) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const casoId = params.get('caso_id') ?? '';
  const origen = params.get('url') ?? '';
  if (!UUID.test(casoId) || !/^https?:\/\//i.test(origen)) {
    return NextResponse.json({ error: 'faltan caso_id o url' }, { status: 400 });
  }
  const mime = (req.headers.get('content-type') ?? '').split(';')[0].trim();
  if (!mime.startsWith('video/') && !mime.startsWith('image/') && mime !== 'application/pdf') {
    return NextResponse.json({ error: 'tipo de archivo no admitido' }, { status: 415 });
  }
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BYTES) {
    return NextResponse.json({ error: 'demasiado grande' }, { status: 413 });
  }

  const datos = new Uint8Array(await req.arrayBuffer());
  if (!datos.byteLength || datos.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: 'archivo vacío o demasiado grande' }, { status: 413 });
  }

  const admin = createAdminClient();
  const { data: caso } = await admin.from('watchdog_alerts').select('id').eq('id', casoId).maybeSingle();
  if (!caso) return NextResponse.json({ error: 'caso no encontrado' }, { status: 404 });

  try {
    const copia = await guardarBytes(admin, { alertId: casoId, tipo: 'origen', url: origen, datos, mime });
    return NextResponse.json({ ok: true, id: copia.id, sha256: copia.sha256 });
  } catch (e) {
    console.error('[auditoria/copia]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'no se pudo guardar' }, { status: 500 });
  }
}
