import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { requireAdminOrEditor } from '@/lib/admin/guard';
import { metadatosPagina } from '@/lib/seo';
import { AdminSidebar, AdminMobileMenu } from '@/components/admin/AdminSidebar';
import { AdminBreadcrumbs } from '@/components/admin/AdminBreadcrumbs';

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
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { perfil, esAdmin, esEditor } = await requireAdminOrEditor();

  return (
    <div className="min-h-screen bg-fondo">
      <div className="mx-auto w-full max-w-wrap px-4 py-6 min-[960px]:flex min-[960px]:gap-8 min-[960px]:px-8 min-[960px]:py-10">
        <AdminSidebar esAdmin={esAdmin} esEditor={esEditor} />
        <div className="min-w-0 flex-1 space-y-5">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AdminMobileMenu esAdmin={esAdmin} esEditor={esEditor} />
              <AdminBreadcrumbs />
            </div>
            <p className="text-[12.5px] text-gris">
              {perfil.display_name ?? perfil.email} ·{' '}
              <span className="font-bold text-titular">{esAdmin ? 'Administrador' : 'Editor'}</span>
            </p>
          </header>
          {children}
        </div>
      </div>
    </div>
  );
}
