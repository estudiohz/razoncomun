import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUsuario } from '@/lib/auth/niveles';
import { metadatosPagina } from '@/lib/seo';
import { PanelSidebar, PanelMobileMenu } from '@/components/panel/PanelNav';
import { gruposPanelUsuario, grupoAdministracion } from '@/lib/panel/nav';
import { cerrarSesion } from '@/app/perfil/actions';
import { contarReportesAbiertos } from '@/lib/participacion/reports';
import { contarBorradores } from '@/lib/participacion/drafts';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Mi panel',
  descripcion: 'Tu área personal en Razón Común.',
  ruta: '/panel',
  noindex: true,
});

const NOMBRE_NIVEL: Record<string, string> = {
  registered: 'Registrado',
  member: 'Afiliado',
  verified: 'Afiliado verificado',
};

/**
 * Shell del panel del usuario (docs/tecnico/panel-usuario.md, olas U1-U3).
 *
 * Mismo marco visual que `/admin` (sidebar full-height + cabecera propia +
 * contenido a todo el ancho) reutilizando components/panel/PanelNav — el panel
 * del usuario normal NO es una interfaz distinta, es el mismo shell con los
 * apartados que su rol permite (D-U1).
 *
 * Guard: aquí basta con tener sesión. Lo que un usuario puede HACER dentro lo
 * decide cada página (y en última instancia la RLS, que es la autoridad real);
 * este layout solo evita renderizar el esqueleto a un anónimo.
 *
 * A diferencia de `/admin`, este panel NO exige 2FA: el middleware solo la
 * impone a quien tiene rol admin/editor o cargo vigente, y un afiliado de a
 * pie no debe tropezarse con eso para ver su propia cuota.
 */
export default async function PanelLayout({ children }: { children: ReactNode }) {
  const { user, perfil, supabase } = await requireUsuario('/panel');

  // El trigger on_auth_user_created garantiza la fila; si faltara, no seguimos.
  if (!perfil) redirect('/entrar');

  const [{ data: esAdmin }, { data: esEditor }] = await Promise.all([
    supabase.rpc('is_admin', { p_user: user.id }),
    supabase.rpc('is_editor', { p_user: user.id }),
  ]);
  const puedeModerar = Boolean(esAdmin) || Boolean(esEditor);

  // Contadores del grupo de administración: solo se consultan si procede, para
  // no cargar a un usuario normal con dos consultas que su RLS devolvería a 0.
  let grupos = gruposPanelUsuario;
  if (puedeModerar) {
    const [reportes, borradores] = await Promise.all([
      contarReportesAbiertos(supabase).catch(() => 0),
      contarBorradores(supabase).catch(() => 0),
    ]);
    grupos = [...gruposPanelUsuario, grupoAdministracion(reportes, borradores)];
  }

  const nombre = perfil.display_name?.trim() || perfil.email || 'Mi cuenta';

  return (
    <div className="min-h-screen w-full bg-fondo min-[960px]:flex">
      <PanelSidebar grupos={grupos} homeHref="/panel" etiqueta="Mi panel" />

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-linea bg-panel px-4 py-3 min-[960px]:px-8">
          <div className="flex items-center gap-3">
            <PanelMobileMenu grupos={grupos} etiqueta="Mi panel" />
            <p className="text-[13px] font-bold text-titular">Mi panel</p>
          </div>
          <div className="flex items-center gap-4">
            <p className="hidden text-[12.5px] text-gris min-[640px]:block">
              {nombre} ·{' '}
              <span className="font-bold text-titular">
                {NOMBRE_NIVEL[perfil.level] ?? perfil.level}
              </span>
            </p>
            <Link
              href="/"
              className="text-[13px] font-semibold text-cuerpo no-underline hover:text-titular"
            >
              Ver la web
            </Link>
            <form action={cerrarSesion}>
              <button type="submit" className="text-[13px] font-semibold text-cuerpo hover:text-titular">
                Cerrar sesión
              </button>
            </form>
          </div>
        </header>

        <main className="w-full px-4 py-6 min-[960px]:px-8 min-[960px]:py-8">{children}</main>
      </div>
    </div>
  );
}
