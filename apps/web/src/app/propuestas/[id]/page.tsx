import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Contenedor } from '@/components/layout/Contenedor';
import { Boton } from '@/components/ui/Boton';
import { EstadoBadge } from '@/components/participacion/EstadoBadge';
import { Deliberacion } from '@/components/participacion/Deliberacion';
import { ApoyoBoton } from '@/components/participacion/ApoyoBoton';
import { metadatosPagina } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';
import { obtenerPropuesta, usuarioApoya } from '@/lib/participacion/proposals';
import { listarAfirmaciones, misVotosAfirmaciones } from '@/lib/participacion/statements';
import type { Vote } from '@/lib/participacion/types';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const propuesta = await obtenerPropuesta(supabase, id);
  return metadatosPagina({
    titulo: propuesta?.title ?? 'Propuesta',
    descripcion: propuesta?.body.slice(0, 160) ?? 'Propuesta del programa vivo de Razón Común.',
    ruta: `/propuestas/${id}`,
    noindex: true,
  });
}

function euros(cents: number | null): string {
  if (cents === null) return 'Sin estimar todavía';
  const signo = cents < 0 ? 'Ahorro de ' : 'Coste de ';
  return (
    signo +
    Math.abs(cents / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
  );
}

export default async function PropuestaDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const propuesta = await obtenerPropuesta(supabase, id);
  if (!propuesta) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [filas, apoya, { data: votaciones }] = await Promise.all([
    listarAfirmaciones(supabase, id),
    user ? usuarioApoya(supabase, id, user.id) : Promise.resolve(false),
    supabase
      .from('votes')
      .select('*')
      .eq('proposal_id', id)
      .order('opens_at', { ascending: false }) as unknown as Promise<{ data: Vote[] | null }>,
  ]);

  const misVotos = user
    ? await misVotosAfirmaciones(
        supabase,
        filas.map((f) => f.statement.id),
      )
    : {};

  const votacionVigente = (votaciones ?? [])[0] ?? null;

  return (
    <Contenedor as="section" className="py-14">
      <div className="mx-auto max-w-[820px]">
        <Link href="/propuestas" className="text-[13.5px] font-semibold text-cuerpo underline">
          ← Volver al tablero de propuestas
        </Link>

        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <EstadoBadge status={propuesta.status} />
          <span className="rounded-lg bg-fondo px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-[.05em] text-cuerpo">
            {propuesta.department.replace(/-/g, ' ')}
          </span>
        </div>

        <h1 className="mt-4 text-[clamp(26px,4vw,38px)] font-extrabold leading-[1.15]">
          {propuesta.title}
        </h1>

        <p className="mt-4 whitespace-pre-line text-[16px] leading-relaxed text-cuerpo">
          {propuesta.body}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-4 rounded-tarjeta border border-linea bg-panel px-5 py-4 text-[14px] text-cuerpo">
          <span className="font-bold text-titular">💶 {euros(propuesta.estimated_cost_cents)}</span>
          {propuesta.report_url && (
            <a
              href={propuesta.report_url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-titular underline"
            >
              🧪 Ver informe del test de estrés
            </a>
          )}
        </div>

        <div className="mt-6">
          <ApoyoBoton proposalId={id} apoyaInicial={apoya} totalInicial={propuesta.support_count} />
        </div>

        {votacionVigente && (
          <div className="mt-6 rounded-tarjeta border border-accion/40 bg-accion/10 p-5">
            <p className="text-[14px] font-bold text-titular">
              🗳️ Esta propuesta tiene una votación asociada.
            </p>
            <Link
              href={`/votaciones/${votacionVigente.id}`}
              className="mt-2 inline-block text-[14px] font-semibold text-titular underline"
            >
              Ir a la votación →
            </Link>
          </div>
        )}

        <section className="mt-12">
          <h2 className="text-[20px] font-extrabold text-titular">Deliberación</h2>
          <p className="mt-1.5 text-[14px] text-gris">
            Vota cada afirmación (de acuerdo / paso / en desacuerdo). El resultado agregado es
            siempre público; tu voto individual en una afirmación es solo tuyo.
          </p>
          <div className="mt-5">
            <Deliberacion proposalId={id} filas={filas} misVotos={misVotos} puedeParticipar={Boolean(user)} />
          </div>
        </section>

        {!user && (
          <div className="mt-10 text-center">
            <Boton href={`/entrar?next=/propuestas/${id}`} variante="grad">
              Entra para apoyar y deliberar
            </Boton>
          </div>
        )}
      </div>
    </Contenedor>
  );
}
