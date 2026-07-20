import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { anonKeySupabase, urlSupabase } from './env';

/**
 * Refresca la sesión de Supabase en cada petición (patrón oficial de
 * @supabase/ssr para Next.js App Router) y devuelve tanto la respuesta
 * como el usuario ya resuelto, para que `middleware.ts` decida los guards
 * de nivel/2FA sin tener que crear un segundo cliente.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(urlSupabase(), anonKeySupabase(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // IMPORTANTE (doc oficial Supabase): no quitar esta llamada. Revalida el
  // JWT contra el servidor de Auth en vez de fiarse solo de la cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, supabase, user };
}
