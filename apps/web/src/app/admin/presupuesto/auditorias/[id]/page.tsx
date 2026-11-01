import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAuditor } from '@/lib/admin/guard';
import { metadatosPagina } from '@/lib/seo';
import { htmlATexto } from '@/lib/vigia/casos';
import { CasoClient, type Caso, type Prueba } from './CasoClient';
import { EnlacesCaso, type PartidaEnlazada, type PartidaOpcion, type Solicitud } from './EnlacesCaso';

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

  const [{ data: caso }, { data: pruebas }, { data: propuestas }, { data: partidas }, { data: enlaces }, { data: solicitudes }] = await Promise.all([
    supabase
      .from('watchdog_alerts')
      .select(
        `id, title, status, organismo, organismo_nivel, adjudicatario, adjudicatario_nif, es_persona_fisica,
         categoria, importe_denunciado_cents, importe_oficial_cents, fecha_adjudicacion, verificacion,
         hechos_html, valoracion_html, ai_extraction, ai_model, replica_solicitada_at, replica_texto, dismiss_reason, verified_at,
         created_at, revisor:profiles!watchdog_alerts_verified_by_fkey(display_name, email),
         fuente:watchdog_sources(permalink, message_text, telegram_from, received_at, transcript)`,
      )
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('watchdog_evidence')
      .select('id, source_kind, expediente, organo, adjudicatario, nif, importe_cents, fecha, url, snapshot_sha256, selected, notes')
      .eq('alert_id', id)
      .order('created_at'),
    supabase.from('proposals').select('id, title, slug, status').eq('source_alert_id', id),
    supabase.from('sim_partidas').select('id, parent_id, nombre, tipo, publicado, slug').order('orden'),
    supabase.from('watchdog_alert_partidas').select('partida_id, nota').eq('alert_id', id),
    supabase
      .from('watchdog_transparency_requests')
      .select(
        'id, organismo, asunto, texto, estado, presentada_at, numero_registro, ampliada_at, respuesta_at, respuesta_texto, respuesta_url, reclamacion_at, reclamacion_numero, notas',
      )
      .eq('alert_id', id)
      .order('created_at'),
  ]);

  if (!caso) notFound();

  // Etiqueta con la ruta completa ("Gastos › Exteriores › Cooperación") para
  // poder elegir la partida en un desplegable plano.
  const porId = new Map((partidas ?? []).map((p) => [p.id, p]));
  const ruta = (pid: string): string => {
    const nombres: string[] = [];
    let actual = porId.get(pid);
    for (let i = 0; actual && i < 8; i++) {
      nombres.unshift(actual.nombre);
      actual = actual.parent_id ? porId.get(actual.parent_id) : undefined;
    }
    return nombres.join(' › ');
  };
  const opciones: PartidaOpcion[] = (partidas ?? [])
    .map((p) => ({ id: p.id, etiqueta: `${p.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'}: ${ruta(p.id)}`, publicado: p.publicado }))
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'));
  const enlazadas: PartidaEnlazada[] = (enlaces ?? []).map((e) => {
    const p = porId.get(e.partida_id);
    return {
      partida_id: e.partida_id,
      nota: e.nota,
      etiqueta: p ? ruta(p.id) : 'Partida no visible',
      slug: p?.slug ?? null,
      publicado: Boolean(p?.publicado),
    };
  });
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());

  return (
    <div className="space-y-6">
      <Link href="/admin/presupuesto/auditorias" className="text-[13px] font-semibold text-gris no-underline hover:text-titular">
        ← Bandeja de auditorías
      </Link>
      <CasoClient caso={caso as unknown as Caso} pruebas={(pruebas ?? []) as Prueba[]} />
      <EnlacesCaso
        alertId={caso.id}
        tituloCaso={caso.title}
        hechosTexto={htmlATexto(caso.hechos_html)}
        propuestas={propuestas ?? []}
        partidas={opciones}
        partidasEnlazadas={enlazadas}
        solicitudes={(solicitudes ?? []) as Solicitud[]}
        hoy={hoy}
      />
    </div>
  );
}
