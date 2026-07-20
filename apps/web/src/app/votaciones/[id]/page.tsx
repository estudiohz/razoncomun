import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Contenedor } from '@/components/layout/Contenedor';
import { VotoForm } from '@/components/participacion/VotoForm';
import { ResultadoVotacion } from '@/components/participacion/ResultadoVotacion';
import { metadatosPagina } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';
import {
  calcularResultado,
  esElegibleVinculante,
  estadoVentana,
  listarBallotsDeVotacion,
  obtenerVotacion,
} from '@/lib/participacion/votes';
import { listarAfirmaciones, mejoresArgumentos } from '@/lib/participacion/statements';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const votacion = await obtenerVotacion(supabase, id);
  return metadatosPagina({
    titulo: votacion?.proposal?.title ?? 'Votación',
    descripcion: 'Votación vinculante de Razón Común: informe, argumentos y resultado con quórum.',
    ruta: `/votaciones/${id}`,
    noindex: true,
  });
}

export default async function VotacionDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const votacion = await obtenerVotacion(supabase, id);
  if (!votacion || !votacion.proposal) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ventana = estadoVentana(votacion);
  const ballots = await listarBallotsDeVotacion(supabase, id);
  const resultado = calcularResultado(votacion, ballots);
  const yaVoto = user ? ballots.find((b) => b.user_id === user.id) ?? null : null;

  let esVinculante = false;
  if (user && !yaVoto) {
    esVinculante = await esElegibleVinculante(supabase, user.id, votacion);
  }

  const filasDeliberacion = await listarAfirmaciones(supabase, votacion.proposal.id);
  const { favor, contra } = mejoresArgumentos(filasDeliberacion);

  return (
    <Contenedor as="section" className="py-14">
      <div className="mx-auto max-w-[780px]">
        <Link href="/votaciones" className="text-[13.5px] font-semibold text-cuerpo underline">
          ← Volver a votaciones
        </Link>

        <h1 className="mt-4 text-[clamp(24px,3.6vw,34px)] font-extrabold leading-[1.15]">
          {votacion.proposal.title}
        </h1>
        <p className="mt-2 text-[13.5px] text-gris">
          Abre {new Date(votacion.opens_at).toLocaleString('es-ES')} · Cierra{' '}
          {new Date(votacion.closes_at).toLocaleString('es-ES')} · Ámbito:{' '}
          {votacion.scope === 'manifesto' ? 'Manifiesto (verificados)' : 'Departamento'} · Quórum{' '}
          {votacion.quorum} · Umbral {(votacion.threshold * 100).toFixed(0)}%
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-4 rounded-tarjeta border border-linea bg-panel px-5 py-4 text-[14px]">
          <Link href={`/propuestas/${votacion.proposal.id}`} className="font-semibold text-titular underline">
            Ver la propuesta completa
          </Link>
          {votacion.proposal.report_url && (
            <a
              href={votacion.proposal.report_url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-titular underline"
            >
              🧪 Informe del test de estrés
            </a>
          )}
        </div>

        {(favor || contra) && (
          <section className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-tarjeta border border-cat-agricultura/40 bg-cat-agricultura/10 p-5">
              <p className="text-[12px] font-bold uppercase tracking-[.05em] text-titular">Argumento más respaldado a favor</p>
              <p className="mt-2 text-[14.5px] text-cuerpo">{favor?.text ?? 'Todavía no hay ninguno con apoyo.'}</p>
            </div>
            <div className="rounded-tarjeta border border-cat-sanidad/40 bg-cat-sanidad/10 p-5">
              <p className="text-[12px] font-bold uppercase tracking-[.05em] text-titular">Argumento más respaldado en contra</p>
              <p className="mt-2 text-[14.5px] text-cuerpo">{contra?.text ?? 'Todavía no hay ninguno con apoyo.'}</p>
            </div>
          </section>
        )}

        <div className="mt-8">
          {ventana === 'abierta' && !user && (
            <p className="rounded-tarjeta border border-linea bg-fondo p-5 text-[14px] text-cuerpo">
              <Link href={`/entrar?next=/votaciones/${id}`} className="font-semibold text-titular underline">
                Entra o regístrate
              </Link>{' '}
              para emitir tu voto.
            </p>
          )}
          {ventana === 'abierta' && user && yaVoto && (
            <p className="rounded-tarjeta border border-linea bg-fondo p-5 text-[14px] font-semibold text-titular">
              Ya has emitido tu voto ({yaVoto.choice}, {yaVoto.weight === 1 ? 'vinculante' : 'consultivo'}). No se
              puede cambiar.
            </p>
          )}
          {ventana === 'abierta' && user && !yaVoto && <VotoForm voteId={id} esVinculante={esVinculante} />}
          {ventana === 'pendiente' && (
            <p className="rounded-tarjeta border border-linea bg-fondo p-5 text-[14px] text-cuerpo">
              Esta votación todavía no ha abierto.
            </p>
          )}
        </div>

        <section className="mt-12">
          <h2 className="text-[20px] font-extrabold text-titular">
            {ventana === 'cerrada' ? 'Resultado final' : 'Resultado en directo'}
          </h2>
          <div className="mt-5">
            <ResultadoVotacion vote={votacion} resultado={resultado} ballots={ballots} />
          </div>
        </section>
      </div>
    </Contenedor>
  );
}
