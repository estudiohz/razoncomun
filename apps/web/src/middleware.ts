import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { requiereMfa } from '@/lib/auth/niveles';

/**
 * Middleware global:
 * 1. Refresca la sesión de Supabase en cada petición (patrón oficial @supabase/ssr).
 * 2. Protege /perfil: exige sesión.
 * 3. Protege /admin: exige sesión Y, si el usuario tiene cargo vigente o rol
 *    admin/editor (I5, revision-seguridad.md), exige además aal2 (2FA activo
 *    y verificado en esta sesión) — sin 2FA, ni admins ni cargos entran.
 *
 * Esto es UX/routing, no la última línea de defensa: las políticas RLS son
 * la autoridad real (C3). Este middleware evita que alguien sin 2FA vea
 * siquiera el HTML del panel; RLS evita que pueda leer/escribir nada aunque
 * se salte el middleware con una petición directa a la API.
 */
export async function middleware(request: NextRequest) {
  const { response, supabase, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const esRutaPerfil = pathname.startsWith('/perfil');
  const esRutaAdmin = pathname.startsWith('/admin');

  if ((esRutaPerfil || esRutaAdmin) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/entrar';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (esRutaAdmin && user) {
    const necesitaMfa = await requiereMfa(supabase, user.id);
    if (necesitaMfa) {
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if ((aalData?.currentLevel ?? 'aal1') !== 'aal2') {
        const url = request.nextUrl.clone();
        url.pathname = '/entrar/2fa';
        url.searchParams.set('next', pathname);
        url.searchParams.set('motivo', 'admin');
        return NextResponse.redirect(url);
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Todas las rutas menos assets estáticos, imágenes, favicon y los
     * archivos públicos de la carpeta /public.
     */
    '/((?!_next/static|_next/image|favicon.ico|logo-rc.*|personas-loop-teal.mp4|personas-loop.webm|fotos/).*)',
  ],
};
