import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { serviceRoleKeySupabase, urlSupabase } from './env';

/**
 * Cliente con la clave `service_role` — bypasa RLS por completo.
 *
 * ⚠️ SOLO usar en código que se ejecuta en el servidor (Route Handlers,
 * webhooks, Server Actions muy concretas): webhook de Stripe Identity,
 * exportación/borrado de cuenta (RGPD), y el trigger de nivel que solo
 * `service_role` puede tocar (profiles_protect_level_trg). NUNCA importar
 * este archivo desde un componente 'use client' ni exponer esta clave al
 * navegador — el repo es público.
 */
export function createAdminClient() {
  if (typeof window !== 'undefined') {
    throw new Error(
      'createAdminClient() es solo de servidor. No lo importes desde código de cliente.',
    );
  }
  return createSupabaseClient(urlSupabase(), serviceRoleKeySupabase(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
