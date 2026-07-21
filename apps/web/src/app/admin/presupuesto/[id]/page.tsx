import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminOrEditor } from '@/lib/admin/guard';
import { metadatosPagina } from '@/lib/seo';
import { listarDemografia, listarParametros, listarPartidas, subarbol } from '@/lib/simulador/adminData';
import { listarMinisterios } from '@/lib/participacion/budget';
import { AreaEditorClient } from './AreaEditorClient';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  return metadatosPagina({
    titulo: 'Admin — Editar área del presupuesto',
    descripcion: 'Editor de partidas del Simulador del Presupuesto del País.',
    ruta: '/admin/presupuesto',
    noindex: true,
  });
}

/**
 * Editor de área (docs/tecnico/simulador-pais.md §5): la raíz + su
 * subárbol completo, con edición en línea y totales recalculados en vivo
 * (el motor corre también en el navegador — `AreaEditorClient` importa
 * `resolver()` directamente, sin duplicar lógica). Se cargan TODAS las
 * partidas (no solo el subárbol) porque el balance global de la cabecera
 * necesita las demás áreas para seguir siendo correcto mientras se edita.
 */
export default async function EditorAreaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdminOrEditor('/admin/presupuesto');

  const [parametros, partidas, ministerios] = await Promise.all([
    listarParametros(supabase),
    listarPartidas(supabase),
    listarMinisterios(supabase),
  ]);

  const raiz = partidas.find((p) => p.id === id);
  if (!raiz || raiz.parent_id !== null) notFound();

  const subarbolRaiz = subarbol(partidas, id);
  const demografia = await listarDemografia(supabase, id);

  return (
    <div className="space-y-6">
      <Link href="/admin/presupuesto" className="text-[13px] font-semibold text-gris hover:text-titular">
        ← Volver al tablero
      </Link>

      <AreaEditorClient
        raizId={id}
        parametros={parametros}
        todasPartidas={partidas}
        subarbolIds={subarbolRaiz.map((p) => p.id)}
        ministerios={ministerios.map((m) => ({ id: m.id, name: m.name }))}
        demografia={demografia}
      />
    </div>
  );
}
