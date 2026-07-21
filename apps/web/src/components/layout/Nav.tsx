import Image from 'next/image';
import Link from 'next/link';
import { Boton } from '@/components/ui/Boton';
import { MenuUsuario } from '@/components/layout/MenuUsuario';
import { MenuMovil } from '@/components/layout/MenuMovil';
import { AvisoContrasena } from '@/components/layout/AvisoContrasena';
import { getUsuarioYPerfil } from '@/lib/auth/niveles';
import { navPrincipal, redesSociales, site } from '@/lib/site';

/** Deriva la inicial del avatar del nombre, o del email como fallback. */
function inicialDe(nombre: string, email: string | null): string {
  const base = nombre.trim() || email?.trim() || '?';
  return base.charAt(0).toUpperCase();
}

/**
 * Nav flotante translúcido con logo e ítems. Fiel a boceto-4-teal.html.
 *
 * Server component: lee la sesión de la petición (getUsuarioYPerfil de rc-03).
 * - Sin sesión → "Entrar" + "Afíliate" (como el boceto original).
 * - Con sesión → menú de usuario (avatar + nombre) con desplegable
 *   Perfil / Admin (solo admin o editor) / Cerrar sesión.
 */
export async function Nav() {
  const { supabase, user, perfil } = await getUsuarioYPerfil();

  // Admin/editor se resuelve con los MISMOS RPC de rc-02 (is_admin/is_editor)
  // que usan los guards, nunca con un claim cacheado del JWT.
  let mostrarAdmin = false;
  // Aviso global "créate una contraseña" (Sergio, bug: quien entra por
  // enlace mágico no tenía dónde fijar una). has_password() (migración
  // 0025, rc-02) solo pregunta por auth.uid(), así que es seguro llamarla
  // aquí sin exponer si OTRO usuario tiene o no contraseña. Si el RPC
  // fallara por lo que sea, se prefiere no mostrar el aviso antes que
  // arriesgarse a mostrarlo a quien sí tiene contraseña.
  let avisoSinContrasena = false;
  if (user) {
    const [{ data: esAdmin }, { data: esEditor }, { data: tieneContrasena, error: errorContrasena }] =
      await Promise.all([
        supabase.rpc('is_admin', { p_user: user.id }),
        supabase.rpc('is_editor', { p_user: user.id }),
        supabase.rpc('has_password'),
      ]);
    mostrarAdmin = Boolean(esAdmin) || Boolean(esEditor);
    avisoSinContrasena = !errorContrasena && tieneContrasena === false;
  }

  const nombre = perfil?.display_name?.trim() || user?.email?.split('@')[0] || 'Mi cuenta';
  const inicial = user ? inicialDe(perfil?.display_name ?? '', user.email ?? null) : '';

  return (
    <>
      <nav className="sticky top-3.5 z-50 my-3.5">
        <div className="mx-auto w-full max-w-wrap px-4 min-[720px]:px-8">
          <div className="flex h-16 items-center justify-between rounded-[18px] border border-linea bg-white/85 px-4 shadow-nav backdrop-blur-[14px] min-[720px]:px-[22px]">
            <Link href="/" className="flex items-center gap-3 no-underline" aria-label={site.nombre}>
              <Image
                src="/logo-rc.png"
                alt={site.nombre}
                width={133}
                height={34}
                priority
                className="h-[34px] w-auto"
              />
            </Link>
            <div className="flex items-center gap-[26px]">
              {navPrincipal.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="hidden text-sm font-medium text-cuerpo no-underline hover:text-titular min-[960px]:inline"
                >
                  {item.label}
                </Link>
              ))}
              {/* Cluster de escritorio: sesión o CTAs. Oculto en móvil (lo cubre el burger). */}
              <div className="hidden items-center gap-[26px] min-[960px]:flex">
                {user ? (
                  <MenuUsuario nombre={nombre} inicial={inicial} mostrarAdmin={mostrarAdmin} />
                ) : (
                  <>
                    <Link
                      href="/entrar"
                      className="text-sm font-medium text-cuerpo no-underline hover:text-titular"
                    >
                      Entrar
                    </Link>
                    <Boton href="/afiliate" variante="grad" className="px-[22px] py-[9px] text-sm">
                      Afíliate
                    </Boton>
                  </>
                )}
              </div>
              {/* Burger + overlay fullscreen: solo <960px. */}
              <MenuMovil
                navItems={navPrincipal}
                redes={redesSociales}
                sesion={user ? { nombre, inicial, mostrarAdmin } : null}
              />
            </div>
          </div>
        </div>
      </nav>
      {/* Banda propia (no sticky) justo debajo del nav flotante: si viviera
          dentro de <nav> heredaría su `sticky top-3.5` y quedaría anclada
          arriba tapando contenido en cada scroll. Así solo se ve al
          aterrizar en la página y al volver a subir del todo. Solo se monta
          si hay sesión y avisoSinContrasena es true (decidido en servidor
          más arriba): un anónimo o alguien con contraseña nunca la reciben
          en el HTML, así que no hay nada que parpadee para ellos. */}
      {user && avisoSinContrasena && <AvisoContrasena userId={user.id} />}
    </>
  );
}
