import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAuditor } from '@/lib/admin/guard';
import { metadatosPagina } from '@/lib/seo';
import { CasoClient, type Caso, type Prueba } from './CasoClient';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Admin — Caso de auditoría',
  descripcion: 'Ficha interna de un caso de auditoría del gasto público.',
  ruta: '/admin/presupuesto/auditorias',
  noindex: true,
});

export const dynamic = 'force-dynamic';

/**
 * Ficha de un caso (T1.3, docs/auditoria-tiempo-real/05-plan-de-proyecto.md):
 * datos del contrato, hechos y valoración por separado (M3), pruebas
 * oficiales, réplica (M6, D-A13) y la firma del auditor (M1).
 */
export default async function CasoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAuditor(`/admin/presupuesto/auditorias/${id}`);

  const [{ data: caso }, { data: pruebas }] = await Promise.all([
    supabase
      .from('watchdog_alerts')
      .select(
        `id, title, status, organismo, organismo_nivel, adjudicatario, adjudicatario_nif, es_persona_fisica,
         categoria, importe_denunciado_cents, importe_oficial_cents, fecha_adjudicacion, verificacion,
         hechos_html, valoracion_html, replica_solicitada_at, replica_texto, dismiss_reason, verified_at,
         created_at, revisor:profiles!watchdog_alerts_verified_by_fkey(display_name, email),
         fuente:watchdog_sources(permalink, message_text, telegram_from, received_at)`,
      )
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('watchdog_evidence')
      .select('id, source_kind, expediente, organo, adjudicatario, nif, importe_cents, fecha, url, snapshot_sha256, selected, notes')
      .eq('alert_id', id)
      .order('created_at'),
  ]);

  if (!caso) notFound();

  return (
    <div className="space-y-6">
      <Link href="/admin/presupuesto/auditorias" className="text-[13px] font-semibold text-gris no-underline hover:text-titular">
        ← Bandeja de auditorías
      </Link>
      <CasoClient caso={caso as unknown as Caso} pruebas={(pruebas ?? []) as Prueba[]} />
    </div>
  );
}
