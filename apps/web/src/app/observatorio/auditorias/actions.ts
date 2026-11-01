'use server';

import { headers } from 'next/headers';
import { verificarCaptcha } from '@/lib/antibot/captcha';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export type EstadoRectificacion = { ok: true } | { error: string } | null;

/**
 * Solicitud pública de rectificación u oposición (M7, LO 2/1984). Sin cuenta:
 * la puede pedir el afectado o su representante. Antibot: captcha HMAC (como
 * el tablero, D-P8), campo trampa y un máximo de 3 solicitudes por correo y
 * día. Se inserta con el cliente de servicio: no hay política de INSERT para
 * el público, así que no se puede escribir por la API saltándose esto.
 */
export async function solicitarRectificacion(_prev: EstadoRectificacion, formData: FormData): Promise<EstadoRectificacion> {
  // Trampa: los bots rellenan todo.
  if (String(formData.get('web') ?? '').trim()) return { ok: true };

  const veredicto = verificarCaptcha(String(formData.get('captcha_token') ?? ''), String(formData.get('captcha_respuesta') ?? ''));
  if (!veredicto.ok) return { error: veredicto.error };

  const slug = String(formData.get('slug') ?? '');
  const nombre = String(formData.get('nombre') ?? '').trim().slice(0, 200);
  const email = String(formData.get('email') ?? '').trim().toLowerCase().slice(0, 200);
  const rol = String(formData.get('rol') ?? '');
  const texto = String(formData.get('texto') ?? '').trim().slice(0, 6000);
  const acepta = formData.get('acepta') === 'on';

  if (!nombre || !texto || texto.length < 20) return { error: 'Indica tu nombre y explica qué hay que corregir.' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'El correo no es válido.' };
  if (!['afectado', 'representante', 'otro'].includes(rol)) return { error: 'Indica en calidad de qué escribes.' };
  if (!acepta) return { error: 'Necesitamos tu consentimiento para tratar estos datos y responderte.' };

  // El caso se busca con el cliente público: solo existe si está publicado.
  const { data: caso } = await (await createClient())
    .from('watchdog_alerts')
    .select('id')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();
  if (!caso) return { error: 'Este caso no existe o ya no está publicado.' };

  const admin = createAdminClient();
  const desde = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await admin
    .from('watchdog_corrections')
    .select('id', { count: 'exact', head: true })
    .eq('requester_email', email)
    .gte('received_at', desde);
  if ((count ?? 0) >= 3) return { error: 'Has enviado varias solicitudes hoy. Te responderemos a las que ya tenemos.' };

  const { error } = await admin.from('watchdog_corrections').insert({
    alert_id: caso.id,
    requester_name: nombre,
    requester_email: email,
    requester_role: rol,
    request_text: texto,
  });
  if (error) {
    console.error('[auditoria/rectificacion]', error.message, (await headers()).get('x-forwarded-for'));
    return { error: 'No se pudo enviar. Inténtalo de nuevo o escríbenos.' };
  }
  return { ok: true };
}
