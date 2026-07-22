import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { requireAdminOrEditor } from '@/lib/admin/guard';
import { metadatosPagina } from '@/lib/seo';
import { AdminSidebar, AdminMobileMenu } from '@/components/admin/AdminSidebar';
import { AdminBreadcrumbs } from '@/components/admin/AdminBreadcrumbs';
import { cerrarSesion } from '@/app/perfil/actions';
import { contarReportesAbiertos } from '@/lib/participacion/reports';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Panel de administración',
  descripcion: 'Panel interno de Razón Común.',
  ruta: '/admin',
  noindex: true,
});

/**
 * Marco común del panel `/admin`, usado por TODAS las secciones (las
 * propias de rc-09 y las que construyen rc-05/06/07 en su hueco de la
 * navegación). Doble puerta de acceso:
 *
 * 1. Middleware (rc-03, src/middleware.ts): exige sesión + 2FA (aal2) si el
 *    usuario tiene rol admin/editor o cargo vigente.
 * 2. `requireAdminOrEditor()` (aquí): exige explícitamente rol de app
 *    admin/editor. Sin ninguno de los dos, ni un `member` autenticado ve
 *    el HTML del panel — se le redirige a `/` antes de renderizar nada.
 *
 * La RLS de cada tabla sigue siendo la autoridad real (C3) por si alguien
 * se salta esto con una petición directa a la API.
 *
 * Shell a pantalla completa, estilo WordPress (feedback Sergio: el admin
 * anterior iba embebido en la web pública — nav/footer + `max-w-wrap` —, y
 * desperdiciaba pantalla en escritorio). `ChromePublico`
 * (components/layout/ChromePublico.tsx) ya se encarga de NO pintar la nav
 * ni el footer públicos en ninguna ruta bajo `/admin`; este layout es el
 * único chrome que ve el panel: sidebar fijo full-height a la izquierda +
 * barra superior propia + contenido al 100% del ancho restante.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { perfil, esAdmin, esEditor, supabase } = await requireAdminOrEditor();

  // Badge de reportes pendientes del tablero de propuestas (D-P15) en el nav.
  // Solo editor/admin ven este apartado; el conteo se deriva sin tocar SQL
  // (ver lib/participacion/reports.ts).
  const reportesAbiertos = esEditor ? await contarReportesAbiertos(supabase).catch(() => 0) : 0;
  const badges: Record<string, number> =
    reportesAbiertos > 0 ? { '/admin/participacion': reportesAbiertos } : {};

  return (
    <div className="min-h-screen w-full bg-fondo min-[960px]:flex">
      <AdminSidebar esAdmin={esAdmin} esEditor={esEditor} badges={badges} />

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-linea bg-panel px-4 py-3 min-[960px]:px-8">
          <div className="flex items-center gap-3">
            <AdminMobileMenu esAdmin={esAdmin} esEditor={esEditor} badges={badges} />
            <AdminBreadcrumbs />
          </div>
          <div className="flex items-center gap-4">
            <p className="hidden text-[12.5px] text-gris min-[640px]:block">
              {perfil.display_name ?? perfil.email} ·{' '}
              <span className="font-bold text-titular">{esAdmin ? 'Administrador' : 'Editor'}</span>
            </p>
            <Link href="/" className="text-[13px] font-semibold text-cuerpo no-underline hover:text-titular">
              Ver la web
            </Link>
            <form action={cerrarSesion}>
              <button
                type="submit"
                className="text-[13px] font-semibold text-cuerpo hover:text-titular"
              >
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
