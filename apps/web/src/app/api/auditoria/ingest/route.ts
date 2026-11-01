import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Entrada del bot de Telegram (n8n) cuando alguien pulsa "🔍 Es una auditoría"
 * (docs/auditoria-tiempo-real/07-decisiones.md, D-A17).
 *
 * `Authorization: Bearer $VIGIA_INGEST_SECRET`. Body JSON:
 * `{ chat_id, message_id, from?, text?, video_file_id? }`.
 * Idempotente por (chat_id, message_id): si n8n reintenta, devuelve el mismo id.
 * El texto se guarda como dato; aquí no se interpreta nada.
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
      },
      { onConflict: 'telegram_chat_id,telegram_message_id', ignoreDuplicates: false },
    )
    .select('id')
    .single();

  if (error) {
    console.error('[auditoria/ingest]', error.message);
    return NextResponse.json({ error: 'no se pudo guardar' }, { status: 500 });
  }

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://razoncomun.com';
  return NextResponse.json({ ok: true, id: data.id, admin_url: `${base}/admin/presupuesto/auditorias` });
}
