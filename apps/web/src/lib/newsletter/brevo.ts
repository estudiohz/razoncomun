import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Webhook de Brevo (docs/tecnico/newsletter.md, D-N4).
 *
 * Brevo no firma sus webhooks, así que la URL lleva una clave: `?k=<token>`.
 * El token se deriva de la service role con un prefijo propio (como la baja
 * con un clic): no hay secreto nuevo que poner en Dokploy, y la clave que se
 * pega en Brevo no sirve para nada más.
 */
const PREFIJO = 'rc-brevo-webhook:v1';

export function tokenWebhook(): string | null {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return clave ? createHmac('sha256', clave).update(PREFIJO).digest('hex') : null;
}

export function tokenWebhookValido(k: string | null): boolean {
  const esperado = tokenWebhook();
  if (!esperado || !k || !/^[0-9a-f]{64}$/i.test(k)) return false;
  return timingSafeEqual(Buffer.from(k, 'hex'), Buffer.from(esperado, 'hex'));
}

export interface EventoBrevo {
  tipo: string;
  email: string | null;
  envioId: string | null;
  campaignId: string | null;
  messageId: string | null;
  url: string | null;
  ocurrido: string;
  huella: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Lee un evento del webhook transaccional de Brevo. Null si no es un evento. */
export function leerEvento(cuerpo: unknown): EventoBrevo | null {
  if (!cuerpo || typeof cuerpo !== 'object') return null;
  const b = cuerpo as Record<string, unknown>;
  const tipo = texto(b.event);
  if (!tipo) return null;

  // Lo que pusimos en `X-Mailin-custom` al enviar (campanas.ts). Brevo lo
  // devuelve como cadena JSON.
  let envioId: string | null = null;
  let campaignId: string | null = null;
  const custom = b['X-Mailin-custom'] ?? b['x-mailin-custom'];
  try {
    const c = typeof custom === 'string' ? JSON.parse(custom) : custom;
    if (c && typeof c === 'object') {
      const o = c as Record<string, unknown>;
      if (typeof o.envio === 'string' && UUID.test(o.envio)) envioId = o.envio;
      if (typeof o.campana === 'string' && UUID.test(o.campana)) campaignId = o.campana;
    }
  } catch {
    /* sin cabecera: se busca por message-id */
  }

  const ts = typeof b.ts_event === 'number' ? b.ts_event : typeof b.ts === 'number' ? b.ts : null;
  const ocurrido = ts ? new Date(ts * 1000).toISOString() : texto(b.date) ? new Date(String(b.date)).toISOString() : new Date().toISOString();
  const messageId = texto(b['message-id']);
  const url = texto(b.link);
  const huella = createHash('sha256')
    .update([tipo, messageId ?? envioId ?? texto(b.email) ?? '', ts ?? texto(b.date) ?? '', url ?? ''].join('|'))
    .digest('hex');

  return { tipo, email: texto(b.email), envioId, campaignId, messageId, url, ocurrido, huella };
}

/** Guarda el evento. Devuelve false si ya estaba (Brevo reintenta). */
export async function guardarEvento(admin: SupabaseClient, ev: EventoBrevo, payload: unknown): Promise<boolean> {
  let { envioId, campaignId } = ev;
  if (!envioId && ev.messageId) {
    const { data } = await admin.from('newsletter_envios').select('id, campaign_id').eq('message_id', ev.messageId).maybeSingle();
    if (data) {
      envioId = data.id;
      campaignId = data.campaign_id;
    }
  }
  if (envioId && !campaignId) {
    const { data } = await admin.from('newsletter_envios').select('campaign_id').eq('id', envioId).maybeSingle();
    campaignId = data?.campaign_id ?? null;
  }
  const { error } = await admin.from('newsletter_eventos').insert({
    envio_id: envioId,
    campaign_id: campaignId,
    tipo: ev.tipo,
    email: ev.email,
    url: ev.url,
    ocurrido_at: ev.ocurrido,
    huella: ev.huella,
    payload,
  });
  if (error?.code === '23505') return false;
  // Un envío que ya no existe (campaña borrada): se guarda sin enlazar.
  if (error?.code === '23503') {
    await admin.from('newsletter_eventos').insert({ tipo: ev.tipo, email: ev.email, url: ev.url, ocurrido_at: ev.ocurrido, huella: ev.huella, payload });
    return true;
  }
  if (error) throw error;
  return true;
}

/**
 * Una baja hecha con NUESTRO enlace (no el de Brevo) también cuenta en las
 * estadísticas: se apunta en el último correo que recibió esa persona.
 */
export async function registrarBajaPropia(admin: SupabaseClient, userId: string): Promise<void> {
  const { data } = await admin
    .from('newsletter_envios')
    .select('id, campaign_id, email')
    .eq('user_id', userId)
    .eq('estado', 'enviado')
    .order('enviado_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return;
  await admin.from('newsletter_eventos').upsert(
    { envio_id: data.id, campaign_id: data.campaign_id, tipo: 'unsubscribed', email: data.email, huella: `baja:${data.id}`, payload: { origen: 'enlace_propio' } },
    { onConflict: 'huella', ignoreDuplicates: true },
  );
}
