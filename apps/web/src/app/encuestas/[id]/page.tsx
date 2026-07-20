import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Contenedor } from '@/components/layout/Contenedor';
import { FormularioEncuesta } from '@/components/participacion/FormularioEncuesta';
import { ResultadosEncuesta } from '@/components/participacion/ResultadosEncuesta';
import { metadatosPagina } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';
import { calcularResultadosEncuesta, obtenerEncuesta } from '@/lib/participacion/surveys';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const encuesta = await obtenerEncuesta(supabase, id);
  return metadatosPagina({
    titulo: encuesta?.survey.title ?? 'Encuesta',
    descripcion: encuesta?.survey.description ?? 'Encuesta de Razón Común.',
    ruta: `/encuestas/${id}`,
    noindex: true,
  });
}

export default async function EncuestaDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const encuesta = await obtenerEncuesta(supabase, id);
  if (!encuesta) notFound(); // RLS oculta si la audiencia no es la propia

  const { survey, preguntas } = encuesta;
  const ahora = Date.now();
  const abierta = ahora >= new Date(survey.opens_at).getTime() && ahora <= new Date(survey.closes_at).getTime();

  const [{ data: esAdmin }, { data: esCoordinador }] = await Promise.all([
    supabase.rpc('is_admin'),
    supabase.rpc('is_coordinator'),
  ]);
  const esAdminOCoordinador = Boolean(esAdmin) || Boolean(esCoordinador);

  const tallies = await calcularResultadosEncuesta(supabase, survey, preguntas, esAdminOCoordinador);

  return (
    <Contenedor as="section" className="py-14">
      <div className="mx-auto max-w-[680px]">
        <h1 className="text-[clamp(24px,3.6vw,32px)] font-extrabold text-titular">{survey.title}</h1>
        {survey.description && <p className="mt-2 text-[14.5px] text-cuerpo">{survey.description}</p>}
        <p className="mt-2 text-[12.5px] text-gris">
          {survey.anonymous ? 'Encuesta anónima' : 'Encuesta con censo (queda ligada a tu cuenta)'} · Cierra{' '}
          {new Date(survey.closes_at).toLocaleString('es-ES')}
        </p>

        <div className="mt-8">
          {abierta ? (
            <FormularioEncuesta surveyId={survey.id} preguntas={preguntas} />
          ) : (
            <p className="rounded-tarjeta border border-linea bg-fondo p-5 text-[14px] text-cuerpo">
              Esta encuesta no está abierta ahora mismo.
            </p>
          )}
        </div>

        <section className="mt-12">
          <h2 className="text-[18px] font-extrabold text-titular">Resultados</h2>
          {tallies ? (
            <div className="mt-4">
              <ResultadosEncuesta preguntas={preguntas} tallies={tallies} />
            </div>
          ) : (
            <p className="mt-2 text-[13.5px] text-gris">
              Los resultados se publican {survey.results_visibility === 'on_close' ? 'al cierre de la encuesta' : 'próximamente'}.
            </p>
          )}
        </section>
      </div>
    </Contenedor>
  );
}
