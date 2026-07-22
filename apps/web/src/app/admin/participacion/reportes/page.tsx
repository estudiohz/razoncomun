import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdminOrEditor } from '@/lib/admin/guard';
import { metadatosPagina } from '@/lib/seo';
import { listarReportes } from '@/lib/participacion/reports';
import { ReportesClient } from './ReportesClient';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Reportes del tablero de propuestas',
  descripcion: 'Cola de moderación reactiva de propuestas y comentarios reportados (D-P15).',
  ruta: '/admin/participacion/reportes',
  noindex: true,
});

export const dynamic = 'force-dynamic';

export default async function ReportesPage() {
  const { supabase } = await requireAdminOrEditor('/admin/participacion/reportes');
  const filas = await listarReportes(supabase);

  return (
    <div className="py-2">
      <Link href="/admin/participacion" className="text-[14px] text-gris no-underline hover:underline">
        ← Volver a Participación
      </Link>
      <h1 className="mb-2 mt-3 text-[24px] font-bold leading-tight text-titular min-[720px]:text-[32px]">
        Reportes
      </h1>
      <p className="mb-6 max-w-2xl text-[13.5px] text-gris">
        Moderación reactiva (D-P15): no hay cola de aprobación previa, solo esta cola de reportes.
        Resolver = archivar la propuesta o moderar el comentario reportado.
      </p>
      <ReportesClient filas={filas} />
    </div>
  );
}
