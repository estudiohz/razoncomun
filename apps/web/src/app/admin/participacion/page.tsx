import type { Metadata } from 'next';
import Link from 'next/link';
import { Contenedor } from '@/components/layout/Contenedor';
import { metadatosPagina } from '@/lib/seo';
import { requireAdminOCoordinador } from '@/lib/participacion/admin-guard';
import { contarReportesAbiertos } from '@/lib/participacion/reports';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Admin — Participación',
  descripcion: 'Gestión de encuestas y participación.',
  ruta: '/admin/participacion',
  noindex: true,
});

/** Hub mínimo del módulo de Participación dentro de /admin (sin depender del
 * marco general del panel, que construye rc-09 en paralelo). */
export default async function AdminParticipacionPage() {
  const { supabase } = await requireAdminOCoordinador('/admin/participacion');
  const reportesAbiertos = await contarReportesAbiertos(supabase);

  return (
    <Contenedor as="section" className="py-14">
      <h1 className="text-[28px] font-extrabold text-titular">Participación</h1>
      <p className="mt-2 text-[14.5px] text-cuerpo">
        Constructor de encuestas y tablero de propuestas (moderación, categorías, reportes).
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/admin/participacion/encuestas"
          className="inline-block rounded-boton bg-accion px-5 py-2.5 text-[14px] font-bold text-white shadow-boton no-underline"
        >
          Encuestas →
        </Link>
        <Link
          href="/admin/participacion/propuestas"
          className="inline-block rounded-boton border border-linea bg-white px-5 py-2.5 text-[14px] font-bold text-titular no-underline hover:border-titular"
        >
          Moderar propuestas →
        </Link>
        <Link
          href="/admin/participacion/categorias"
          className="inline-block rounded-boton border border-linea bg-white px-5 py-2.5 text-[14px] font-bold text-titular no-underline hover:border-titular"
        >
          Categorías del tablero →
        </Link>
        <Link
          href="/admin/participacion/reportes"
          className="relative inline-block rounded-boton border border-linea bg-white px-5 py-2.5 text-[14px] font-bold text-titular no-underline hover:border-titular"
        >
          Reportes →
          {reportesAbiertos > 0 && (
            <span className="ml-2 rounded-full bg-magenta px-2 py-0.5 text-[11px] font-bold text-white">
              {reportesAbiertos}
            </span>
          )}
        </Link>
      </div>
    </Contenedor>
  );
}
