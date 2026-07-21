import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdminOrEditor } from '@/lib/admin/guard';
import { metadatosPagina } from '@/lib/seo';
import { listarDemografia } from '@/lib/simulador/adminData';
import { DemografiaClient } from '../DemografiaClient';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Admin — Población de España',
  descripcion: 'CRUD de los segmentos de población que aparecen en /pais (jubilados, funcionarios, estudiantes…).',
  ruta: '/admin/presupuesto/poblacion',
  noindex: true,
});

/**
 * `area_id is null` de `sim_demografia` (D-S12): la sección "Población de
 * España" que aparece en `/pais` justo tras la Cabecera. Vive como página
 * propia del admin (no dentro de un editor de área concreta) porque no
 * pertenece a ningún ministerio — es un dato de país.
 */
export default async function PoblacionPage() {
  const { supabase } = await requireAdminOrEditor('/admin/presupuesto');
  const filas = await listarDemografia(supabase, null);

  return (
    <div className="space-y-6">
      <Link href="/admin/presupuesto" className="text-[13px] font-semibold text-gris hover:text-titular">
        ← Volver al tablero
      </Link>
      <div>
        <h1 className="text-[24px] font-extrabold text-titular">Población de España</h1>
        <p className="mt-1 max-w-[65ch] text-[13.5px] text-cuerpo">
          Segmentos de población (jubilados, funcionarios, estudiantes, autónomos, niños…) que se muestran en{' '}
          <code>/pais</code> justo tras la cabecera. Si existe una fila publicada llamada exactamente{' '}
          <strong>&quot;Población total de España&quot;</strong>, se usa como referencia para calcular el donut de
          composición.
        </p>
      </div>
      <DemografiaClient areaId={null} filas={filas} />
    </div>
  );
}
