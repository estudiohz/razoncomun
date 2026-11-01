import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { columnasDesdeExtraccion, confianzas } from '@/lib/vigia/extraccion';

/**
 * Entrada del bot de Telegram (n8n) cuando alguien pulsa "🔍 Es una auditoría"
 * (docs/auditoria-tiempo-real/07-decisiones.md, D-A17).
 *
 * `Authorization: Bearer $VIGIA_INGEST_SECRET`. Body JSON:
 * `{ chat_id, message_id, from?, text?, video_file_id?, transcript?, ai_model?, extraction? }`.
 * Idempotente por (chat_id, message_id): si n8n reintenta, devuelve el mismo id.
 *
 * Sergio (01-11-2026): el caso se rellena a partir del reel y el auditor solo
 * supervisa. Así que, además de guardar el envío en la bandeja, se abre el
 * caso ya relleno con la extracción de Gemini (validada en
 * lib/vigia/extraccion.ts: es salida de un modelo sobre texto ajeno, se trata
 * como dato). Sin extracción, el caso se abre igual, vacío.
 */
export const dynamic = 'force-dynamic';

function autorizado(req: Request): boolean {
  const esperado = process.env.VIGIA_INGEST_SECRET?.trim();
  if (!esperado) return false;
  const recibido = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

function texto(v: unknown, max: number): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}

export async function POST(req: Request) {
  if (!autorizado(req)) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const chatId = texto(body.chat_id, 64);
  const messageId = texto(body.message_id, 64);
  if (!chatId || !messageId) {
    return NextResponse.json({ error: 'faltan chat_id y message_id' }, { status: 400 });
  }

  const mensaje = texto(body.text, 4000);
  const videoFileId = texto(body.video_file_id, 256);
  if (!mensaje && !videoFileId) {
    return NextResponse.json({ error: 'el mensaje no trae texto ni vídeo' }, { status: 400 });
  }

  const enlace = mensaje?.match(/https?:\/\/\S+/)?.[0] ?? null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('watchdog_sources')
    .upsert(
      {
        kind: 'telegram',
        telegram_chat_id: chatId,
        telegram_message_id: messageId,
        telegram_from: texto(body.from, 128),
        message_text: mensaje,
        permalink: enlace,
        video_file_id: videoFileId,
        transcript: texto(body.transcript, 20000),
        ai_model: texto(body.ai_model, 100),
      },
      { onConflict: 'telegram_chat_id,telegram_message_id', ignoreDuplicates: false },
    )
    .select('id')
    .single();

  if (error) {
    console.error('[auditoria/ingest]', error.message);
    return NextResponse.json({ error: 'no se pudo guardar' }, { status: 500 });
  }

  // Un caso por envío: si n8n reintenta, no se duplica.
  let casoId: string | null = null;
  const { data: existente } = await admin.from('watchdog_alerts').select('id').eq('source_id', data.id).maybeSingle();
  if (existente) {
    casoId = existente.id;
  } else {
    const extraccion = body.extraction && typeof body.extraction === 'object' ? body.extraction : null;
    const columnas = extraccion ? columnasDesdeExtraccion(extraccion) : null;
    const resumen = (mensaje ?? enlace ?? 'Vídeo enviado por Telegram').trim();
    const { data: caso, error: errCaso } = await admin
      .from('watchdog_alerts')
      .insert({
        ...(columnas ?? {}),
        title: columnas?.title ?? resumen.slice(0, 120),
        description: resumen.slice(0, 4000),
        status: columnas ? 'analyzed' : 'flagged',
        source_id: data.id,
        ai_extraction: extraccion ? { ...extraccion, _confianzas: confianzas(extraccion) } : null,
        ai_model: texto(body.ai_model, 100),
      })
      .select('id')
      .single();
    if (errCaso) {
      // El envío ya está en la bandeja: el auditor puede abrir el caso a mano.
      console.error('[auditoria/ingest] caso', errCaso.message);
    } else {
      casoId = caso.id;
      await admin.from('watchdog_sources').update({ status: 'en_revision' }).eq('id', data.id);
    }
  }

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://razoncomun.com';
  const ruta = casoId ? `/admin/presupuesto/auditorias/${casoId}` : '/admin/presupuesto/auditorias';
  return NextResponse.json({ ok: true, id: data.id, caso_id: casoId, admin_url: `${base}${ruta}` });
}
