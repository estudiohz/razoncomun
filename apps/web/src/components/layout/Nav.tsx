import Image from 'next/image';
import Link from 'next/link';
import { Boton } from '@/components/ui/Boton';
import { MenuUsuario } from '@/components/layout/MenuUsuario';
import { getUsuarioYPerfil } from '@/lib/auth/niveles';
import { navPrincipal, site } from '@/lib/site';

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
  if (user) {
    const [{ data: esAdmin }, { data: esEditor }] = await Promise.all([
      supabase.rpc('is_admin', { p_user: user.id }),
      supabase.rpc('is_editor', { p_user: user.id }),
    ]);
    mostrarAdmin = Boolean(esAdmin) || Boolean(esEditor);
  }

  const nombre = perfil?.display_name?.trim() || user?.email?.split('@')[0] || 'Mi cuenta';

  return (
    <nav className="sticky top-3.5 z-50 my-3.5">
      <div className="mx-auto w-full max-w-wrap px-8">
        <div className="flex h-16 items-center justify-between rounded-[18px] border border-linea bg-white/85 px-[22px] shadow-nav backdrop-blur-[14px]">
          <Link href="/" className="flex items-center gap-3 no-underline" aria-label={site.nombre}>
            <Image
              src="/logo-rc.png"
              alt={site.nombre}
              width={150}
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
            {user ? (
              <MenuUsuario
                nombre={nombre}
                inicial={inicialDe(perfil?.display_name ?? '', user.email ?? null)}
                mostrarAdmin={mostrarAdmin}
              />
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
        </div>
      </div>
    </nav>
  );
}
