import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { anonKeySupabase, claveCookieSesion, urlSupabaseServidor } from './env';

/**
 * Cliente Supabase para Server Components, Server Actions y Route Handlers.
 * Lee/escribe la sesión en las cookies de la petición. El `setAll` puede
 * fallar en un Server Component puro (no puede escribir cookies) — se
 * ignora ahí a propósito porque el middleware (`src/middleware.ts`) ya se
 * encarga de refrescar la sesión en cada petición.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(urlSupabaseServidor(), anonKeySupabase(), {
    // Sin esto, el nombre de la cookie saldria del host INTERNO y no
    // coincidiria con el que escribe el navegador. Ver claveCookieSesion().
    cookieOptions: { name: claveCookieSesion() },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component: no puede escribir cookies. No pasa nada, el
          // middleware refresca la sesión en la siguiente petición.
        }
      },
    },
  });
}
