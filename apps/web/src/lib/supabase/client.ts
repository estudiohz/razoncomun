'use client';

import { createBrowserClient } from '@supabase/ssr';
import { anonKeySupabase, urlSupabase } from './env';

/**
 * Cliente Supabase para Componentes Cliente ('use client'). Usa la clave
 * anon — nunca la service_role. La sesión vive en cookies (no localStorage)
 * para que el servidor (middleware, Server Components) la pueda leer.
 */
export function createClient() {
  return createBrowserClient(urlSupabase(), anonKeySupabase());
}
