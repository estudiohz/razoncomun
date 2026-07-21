import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdminOrEditor } from '@/lib/admin/guard';
import { metadatosPagina } from '@/lib/seo';
import { listarParametros } from '@/lib/simulador/adminData';
import { ParametrosClient } from './ParametrosClient';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Admin — Parámetros del presupuesto',
  descripcion: 'CRUD de parámetros (variables reales y elasticidades) del Simulador del Presupuesto del País.',
  ruta: '/admin/presupuesto/parametros',
  noindex: true,
});

export default async function ParametrosPage() {
  const { supabase } = await requireAdminOrEditor('/admin/presupuesto/parametros');
  const parametros = await listarParametros(supabase);

  return (
    <div className="space-y-6">
      <Link href="/admin/presupuesto" className="text-[13px] font-semibold text-gris hover:text-titular">
        ← Volver al tablero
      </Link>
      <div>
        <h1 className="text-[24px] font-extrabold text-titular">Parámetros</h1>
        <p className="mt-1 max-w-[65ch] text-[13.5px] text-cuerpo">
          Variables reales (nº de autónomos, precio del billete…) que alimentan las fórmulas de las
          partidas. Un parámetro <strong>derivado</strong> (modo fórmula) modela una elasticidad —
          nunca puede ser palanca (D-S2b) — y se valida contra ciclos al guardar.
        </p>
      </div>
      <ParametrosClient parametros={parametros} />
    </div>
  );
}
