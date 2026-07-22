import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminOrEditor } from '@/lib/admin/guard';
import { metadatosPagina } from '@/lib/seo';
import { ETIQUETA_ESTADO, type Propuesta } from '@/lib/participacion/types';
import { ModerarPropuestaClient } from './ModerarPropuestaClient';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Moderar propuesta',
  descripcion: 'Ficha de moderación de una propuesta del tablero.',
  ruta: '/admin/participacion/propuestas',
  noindex: true,
});

export const dynamic = 'force-dynamic';

export default async function ModerarPropuestaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fusionada?: string }>;
}) {
  const { id } = await params;
  const { fusionada } = await searchParams;
  const { supabase } = await requireAdminOrEditor(`/admin/participacion/propuestas/${id}`);

  const { data, error } = await supabase.from('proposals').select('*').eq('id', id).single();
  if (error || !data) notFound();

  const propuesta = data as Propuesta;

  const { data: categoria } = propuesta.category_id
    ? await supabase.from('proposal_categories').select('nombre, color').eq('id', propuesta.category_id).single()
    : { data: null };

  return (
    <div className="py-2">
      <Link href="/admin/participacion/propuestas" className="text-[14px] text-gris no-underline hover:underline">
        ← Volver al listado
      </Link>

      {fusionada && (
        <p className="mt-3 rounded-boton border border-linea bg-fondo px-4 py-2 text-[13.5px] font-semibold text-titular">
          Se ha recibido una fusión de otra propuesta duplicada.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold leading-tight text-titular min-[720px]:text-[28px]">
            {propuesta.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px] text-gris">
            <span className="rounded-full bg-fondo px-2.5 py-0.5 font-bold text-cuerpo ring-1 ring-linea">
              {ETIQUETA_ESTADO[propuesta.status]}
            </span>
            {categoria && (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: categoria.color }} />
                {categoria.nombre}
              </span>
            )}
            <span>{propuesta.support_count} apoyos</span>
            {propuesta.merged_into_id && <span>· fusionada en otra propuesta</span>}
          </div>
        </div>
        <a
          href={propuesta.slug ? `/propuestas/${propuesta.slug}` : `/propuestas/${propuesta.id}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-boton border border-linea bg-white px-4 py-2 text-[13px] font-bold text-titular no-underline hover:border-titular"
        >
          Ver hilo público ↗
        </a>
      </div>

      <p className="mt-4 max-w-3xl whitespace-pre-wrap text-[14.5px] text-cuerpo">{propuesta.body}</p>

      <div className="mt-8">
        <ModerarPropuestaClient propuesta={propuesta} />
      </div>
    </div>
  );
}
