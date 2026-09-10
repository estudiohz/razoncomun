'use client';

import { createBrowserClient } from '@supabase/ssr';
import { anonKeySupabase, claveCookieSesion, urlSupabase } from './env';

/**
 * Cliente Supabase para Componentes Cliente ('use client'). Usa la clave
 * anon — nunca la service_role. La sesión vive en cookies (no localStorage)
 * para que el servidor (middleware, Server Components) la pueda leer.
 */
export function createClient() {
  // El nombre se fija explicitamente aunque aqui coincidiria con el que
  // supabase-js calcularia solo: asi navegador y servidor lo sacan del MISMO
  // sitio y no pueden volver a separarse. Ver claveCookieSesion().
  return createBrowserClient(urlSupabase(), anonKeySupabase(), {
    cookieOptions: { name: claveCookieSesion() },
  });
}
