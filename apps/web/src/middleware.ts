import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { requiereMfa } from '@/lib/auth/niveles';
import { entornoCerrado } from '@/lib/entorno';

/**
 * Middleware global:
 * 0. Entorno cerrado (dev, `RC_ENTORNO_CERRADO=true`): la web ENTERA exige
 *    sesión y se marca como no indexable. dev sirve el mismo contenido que
 *    producción, así que sin esto Google lo indexaría y competiría con la web
 *    real por las mismas búsquedas.
 * 1. Refresca la sesión de Supabase en cada petición (patrón oficial @supabase/ssr).
 * 2. Protege /panel (y /perfil, que ya solo redirige allí): exige sesión.
 *    OJO: /panel NO exige 2FA. El panel del usuario es donde un socio ve su
 *    cuota y sus datos; obligarle a 2FA para eso sería una barrera que nadie
 *    ha decidido. La 2FA sigue siendo obligatoria solo para /admin (abajo).
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

  // Un logueado que entra en la portada va directo a su entorno colaborativo
  // (decisión de Sergio, 02/08/2026): la home corporativa es de captación y a
  // quien ya está dentro no le aporta. Excepción: `/?web=1` — es el destino de
  // "Ver la web" en las cabeceras de los paneles, que existe justo para eso.
  if (pathname === '/' && user && !request.nextUrl.searchParams.has('web')) {
    const url = request.nextUrl.clone();
    url.pathname = '/panel';
    return NextResponse.redirect(url);
  }

  // ── Entorno cerrado (dev): la web entera tras el login ──────────────────
  //
  // Se comprueba ANTES que cualquier otra regla: en dev no debe poder verse ni
  // la portada sin sesión. Se dejan pasar solo las rutas imprescindibles para
  // poder autenticarse — si no, el usuario no podría ni llegar al formulario.
  //
  // Además se marca TODA respuesta como no indexable con `X-Robots-Tag`: la
  // cabecera la respetan los buscadores aunque alguien enlace una URL suelta,
  // cosa que un `robots.txt` por sí solo no garantiza.
  if (entornoCerrado()) {
    const abierta =
      pathname.startsWith('/entrar') ||
      pathname.startsWith('/auth') ||
      pathname.startsWith('/recuperar') ||
      pathname.startsWith('/api/auth') ||
      // Webhooks: NO se autentican con sesión sino con la firma de Stripe,
      // que se verifica dentro de cada ruta. Ponerles el login delante no
      // añadía seguridad — solo hacía imposible recibirlos en dev, que es
      // justo donde hay que probarlos antes de tocar producción. Sin firma
      // válida responden 400 igual que en producción.
      pathname.startsWith('/api/stripe') ||
      // Verificador del carnet: mismo razonamiento que los webhooks. No se
      // autentica con sesión sino con el token firmado de la propia URL, que
      // se comprueba dentro de la ruta. Y sobre todo: lo escanea un móvil
      // AJENO, que por definición no tiene sesión — dejarlo tras el login
      // hace imposible probar el QR en dev, que es justo donde hay que
      // probarlo. Un token inválido responde "no válido" igual que en
      // producción, sin tocar la base de datos.
      pathname.startsWith('/carnet/v/') ||
      pathname === '/robots.txt' ||
      pathname === '/sitemap.xml' ||
      pathname === '/favicon.ico';

    if (!abierta && !user) {
      const url = request.nextUrl.clone();
      url.pathname = '/entrar';
      url.searchParams.set('next', pathname);
      const redir = NextResponse.redirect(url);
      redir.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
      return redir;
    }
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }

  const esRutaPanel = pathname.startsWith('/panel') || pathname.startsWith('/perfil');
  const esRutaAdmin = pathname.startsWith('/admin');

  if ((esRutaPanel || esRutaAdmin) && !user) {
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
    '/((?!_next/static|_next/image|favicon.ico|logo-rc.*|personas-loop-teal.mp4|personas-loop.webm|personas-loop-hevc.mov|fotos/).*)',
  ],
};
