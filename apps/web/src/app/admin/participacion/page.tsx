import type { Metadata } from 'next';
import Link from 'next/link';
import { Contenedor } from '@/components/layout/Contenedor';
import { metadatosPagina } from '@/lib/seo';
import { requireAdminOCoordinador } from '@/lib/participacion/admin-guard';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Admin — Participación',
  descripcion: 'Gestión de encuestas y participación.',
  ruta: '/admin/participacion',
  noindex: true,
});

/** Hub mínimo del módulo de Participación dentro de /admin (sin depender del
 * marco general del panel, que construye rc-09 en paralelo). */
export default async function AdminParticipacionPage() {
  await requireAdminOCoordinador('/admin/participacion');

  return (
    <Contenedor as="section" className="py-14">
      <h1 className="text-[28px] font-extrabold text-titular">Participación</h1>
      <p className="mt-2 text-[14.5px] text-cuerpo">
        Moderación de propuestas y apertura de votaciones viven en el panel general de rc-09.
        Desde aquí se gestiona el constructor de encuestas.
      </p>
      <div className="mt-6">
        <Link
          href="/admin/participacion/encuestas"
          className="inline-block rounded-boton bg-accion px-5 py-2.5 text-[14px] font-bold text-white shadow-boton"
        >
          Encuestas →
        </Link>
      </div>
    </Contenedor>
  );
}
