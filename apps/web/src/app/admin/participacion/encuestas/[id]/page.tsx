import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { metadatosPagina } from '@/lib/seo';
import { requireAdminOCoordinador } from '@/lib/participacion/admin-guard';
import {
  EditorEncuestaClient,
  type EncuestaEditor,
  type PreguntaEditor,
} from './EditorEncuestaClient';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Admin — Editar encuesta',
  descripcion: 'Edición de una encuesta: datos, preguntas y mes destacado.',
  ruta: '/admin/participacion/encuestas',
  noindex: true,
});

export const dynamic = 'force-dynamic';

/** Editor de encuesta (02/08/2026 — antes solo existía "crear"). */
export default async function EditarEncuestaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireAdminOCoordinador(`/admin/participacion/encuestas/${id}`);

  const [{ data: encuesta }, { data: preguntas }, { data: respuestas }] = await Promise.all([
    supabase
      .from('surveys')
      .select('id, title, description, closes_at, results_visibility, featured_month, audience, anonymous')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('survey_questions')
      .select('id, position, kind, text, options, info, proposal:proposals(slug)')
      .eq('survey_id', id)
      .order('position'),
    supabase.from('survey_responses').select('question_id').eq('survey_id', id),
  ]);

  if (!encuesta) notFound();

  const conteo = new Map<string, number>();
  for (const r of respuestas ?? []) {
    conteo.set(r.question_id, (conteo.get(r.question_id) ?? 0) + 1);
  }

  const filas: PreguntaEditor[] = ((preguntas ?? []) as unknown as {
    id: string;
    position: number;
    kind: string;
    text: string;
    options: { options?: string[] } | string[] | null;
    info: string | null;
    proposal: { slug: string | null } | { slug: string | null }[] | null;
  }[]).map((p) => {
    const proposal = Array.isArray(p.proposal) ? (p.proposal[0] ?? null) : p.proposal;
    return {
      id: p.id,
      position: p.position,
      kind: p.kind,
      text: p.text,
      options: Array.isArray(p.options) ? p.options : (p.options?.options ?? null),
      info: p.info,
      proposal_slug: proposal?.slug ?? null,
      respuestas: conteo.get(p.id) ?? 0,
    };
  });

  return (
    <div className="mx-auto w-full max-w-[720px] space-y-5">
      <div>
        <Link
          href="/admin/participacion/encuestas"
          className="text-[13.5px] text-gris no-underline hover:underline"
        >
          ← Volver a encuestas
        </Link>
        <h1 className="mt-2 text-[22px] font-extrabold leading-tight min-[720px]:text-[28px]">
          Editar encuesta
        </h1>
      </div>

      <EditorEncuestaClient encuesta={encuesta as EncuestaEditor} preguntas={filas} />
    </div>
  );
}
