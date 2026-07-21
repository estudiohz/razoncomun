import type { Metadata } from 'next';
import Link from 'next/link';
import { requireEditorCerebro } from '@/lib/brain/guard';
import { metadatosPagina } from '@/lib/seo';
import { ContribucionesClient, type FilaContribucion, type TriajeIA } from './ContribucionesClient';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Contribuciones al cerebro',
  descripcion: 'Cola de aportaciones ciudadanas pendientes de revisión.',
  ruta: '/admin/cerebro/contribuciones',
  noindex: true,
});

export const dynamic = 'force-dynamic';

type Rel<T> = T | T[] | null;
const uno = <T,>(v: Rel<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

interface FilaCruda {
  id: string;
  created_at: string;
  body: string;
  claimed_wrong: string | null;
  claimed_right: string | null;
  source_url: string | null;
  status: FilaContribucion['status'];
  ai_triage: TriajeIA | null;
  turn: { pregunta?: string | null; respuesta?: string | null } | null;
  related_entry_id: string | null;
  resolution_note: string | null;
  autor: Rel<{ display_name: string | null }>;
  entrada: Rel<{ title: string }>;
}

const SEV_RANK: Record<string, number> = { alta: 0, media: 1, baja: 2 };
const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

export default async function ContribucionesPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { supabase } = await requireEditorCerebro('/admin/cerebro/contribuciones');
  const sp = await searchParams;
  const estado = (sp.estado ?? 'pendientes').trim();

  // Conteos por estado para las pestañas.
  const estados = ['nueva', 'triaged', 'aceptada', 'rechazada', 'fusionada'] as const;
  const conteos = Object.fromEntries(
    await Promise.all(
      estados.map(async (s) => {
        const { count } = await supabase
          .from('brain_contributions')
          .select('id', { count: 'exact', head: true })
          .eq('status', s);
        return [s, count ?? 0] as const;
      }),
    ),
  ) as Record<(typeof estados)[number], number>;

  let consulta = supabase
    .from('brain_contributions')
    .select(
      'id, created_at, body, claimed_wrong, claimed_right, source_url, status, ai_triage, turn, related_entry_id, resolution_note, autor:profiles(display_name), entrada:brain_entries(title)',
    )
    .order('created_at', { ascending: false })
    .limit(300);

  if (estado === 'pendientes') consulta = consulta.in('status', ['nueva', 'triaged']);
  else if (estados.includes(estado as (typeof estados)[number])) consulta = consulta.eq('status', estado);

  const { data, error } = await consulta;

  let filas: FilaContribucion[] = (data ?? []).map((c) => {
    const f = c as unknown as FilaCruda;
    return {
      id: f.id,
      creado: fecha(f.created_at),
      body: f.body,
      claimedWrong: f.claimed_wrong,
      claimedRight: f.claimed_right,
      sourceUrl: f.source_url,
      status: f.status,
      triage: f.ai_triage,
      pregunta: f.turn?.pregunta ?? null,
      autor: uno(f.autor)?.display_name ?? null,
      relatedEntryId: f.related_entry_id,
      entradaTitulo: uno(f.entrada)?.title ?? null,
      resolutionNote: f.resolution_note,
    };
  });

  // Orden de la cola de pendientes: accionable primero, luego severidad, luego
  // recencia (ya viene por fecha desc de la query).
  if (estado === 'pendientes') {
    filas = filas.sort((a, b) => {
      const accA = a.triage?.accionable ? 0 : 1;
      const accB = b.triage?.accionable ? 0 : 1;
      if (accA !== accB) return accA - accB;
      const sevA = SEV_RANK[a.triage?.severidad ?? 'baja'] ?? 2;
      const sevB = SEV_RANK[b.triage?.severidad ?? 'baja'] ?? 2;
      return sevA - sevB;
    });
  }

  return (
    <div className="py-2">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/admin/cerebro" className="text-[13px] text-gris no-underline hover:underline">
            ← Cerebro
          </Link>
          <h1 className="mt-1 text-[24px] font-bold leading-tight text-titular min-[720px]:text-[32px]">
            Contribuciones ciudadanas
          </h1>
          <p className="mt-1 text-[13.5px] text-gris">
            Aportaciones de usuarios registrados desde el chat. La IA las prioriza; tú decides qué
            entra al cerebro. Aceptar o rechazar no toca el corpus por sí solo — para aplicar una
            corrección, edita la entrada.
          </p>
        </div>
      </div>

      {error ? (
        <p className="rounded-tarjeta border border-linea bg-white p-6 text-cuerpo">
          No se han podido cargar las contribuciones: {error.message}
        </p>
      ) : (
        <ContribucionesClient filas={filas} estado={estado} conteos={conteos} />
      )}
    </div>
  );
}
