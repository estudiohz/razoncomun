import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { Contenedor } from '@/components/layout/Contenedor';
import { Boton } from '@/components/ui/Boton';
import { EstadoBadge } from '@/components/participacion/EstadoBadge';
import { Deliberacion } from '@/components/participacion/Deliberacion';
import { ApoyoBoton } from '@/components/participacion/ApoyoBoton';
import { ComentariosHilo } from '@/components/participacion/ComentariosHilo';
import { SuscripcionBoton } from '@/components/participacion/SuscripcionBoton';
import { metadatosPagina } from '@/lib/seo';
import { site } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';
import {
  obtenerPropuesta,
  obtenerPropuestaPorSlug,
  pareceUuid,
  usuarioApoya,
} from '@/lib/participacion/proposals';
import { listarAfirmaciones, misVotosAfirmaciones } from '@/lib/participacion/statements';
import { listarComentarios, usuarioDioLike } from '@/lib/participacion/comments';
import { usuarioSigue } from '@/lib/participacion/follows';
import { votacionAbierta, type Vote } from '@/lib/participacion/types';
import type { SupabaseClient } from '@supabase/supabase-js';

async function resolverPropuesta(supabase: SupabaseClient, slugOId: string) {
  if (pareceUuid(slugOId)) {
    const porId = await obtenerPropuesta(supabase, slugOId);
    if (!porId) return null;
    // Redirect uuid → slug (no romper enlaces existentes, D-P12).
    permanentRedirect(`/propuestas/${porId.slug ?? porId.id}`);
  }
  return obtenerPropuestaPorSlug(supabase, slugOId);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const propuesta = pareceUuid(slug) ? null : await obtenerPropuestaPorSlug(supabase, slug);
  return metadatosPagina({
    titulo: propuesta?.title ?? 'Propuesta',
    descripcion: propuesta?.body.slice(0, 160) ?? 'Propuesta del programa vivo de Razón Común.',
    ruta: `/propuestas/${slug}`,
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
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const propuesta = await resolverPropuesta(supabase, slug);
  if (!propuesta) notFound();

  // D-P11: fusionada → redirect 301 al destino.
  if (propuesta.merged_into_id) {
    const destino = await obtenerPropuesta(supabase, propuesta.merged_into_id);
    redirect(`/propuestas/${destino?.slug ?? propuesta.merged_into_id}`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const abierta = votacionAbierta(propuesta);

  const [filas, apoya, siguiendo, comentarios, { data: votaciones }] = await Promise.all([
    propuesta.status === 'deliberation' ? listarAfirmaciones(supabase, propuesta.id) : Promise.resolve([]),
    user ? usuarioApoya(supabase, propuesta.id, user.id) : Promise.resolve(false),
    user ? usuarioSigue(supabase, propuesta.id, user.id) : Promise.resolve(false),
    listarComentarios(supabase, propuesta.id),
    supabase
      .from('votes')
      .select('*')
      .eq('proposal_id', propuesta.id)
      .order('opens_at', { ascending: false }) as unknown as Promise<{ data: Vote[] | null }>,
  ]);

  const misVotos = user
    ? await misVotosAfirmaciones(
        supabase,
        filas.map((f) => f.statement.id),
      )
    : {};

  const misLikes: Record<string, boolean> = {};
  if (user) {
    await Promise.all(
      comentarios
        .filter((c) => c.body !== null)
        .map(async (c) => {
          misLikes[c.id] = await usuarioDioLike(supabase, c.id, user.id);
        }),
    );
  }

  const votacionVigente = (votaciones ?? [])[0] ?? null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DiscussionForumPosting',
    headline: propuesta.title,
    text: propuesta.body,
    url: `${site.urlBase}/propuestas/${propuesta.slug ?? propuesta.id}`,
    datePublished: propuesta.created_at,
    dateModified: propuesta.updated_at,
    interactionStatistic: {
      '@type': 'InteractionCounter',
      interactionType: 'https://schema.org/LikeAction',
      userInteractionCount: propuesta.support_count,
    },
    ...(comentarios.length > 0
      ? {
          comment: comentarios
            .filter((c) => c.body !== null)
            .slice(0, 20)
            .map((c) => ({
              '@type': 'Comment',
              text: c.body,
              dateCreated: c.created_at,
            })),
        }
      : {}),
  };

  return (
    <Contenedor as="section" className="py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
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

        {/* D-P10: respuesta oficial fijada, destacada arriba. */}
        {propuesta.official_response && (
          <div className="mt-5 rounded-tarjeta border border-accion bg-accion/10 p-5">
            <p className="text-[12px] font-extrabold uppercase tracking-[.08em] text-titular">
              📌 Respuesta oficial
              {propuesta.official_response_at && (
                <span className="ml-2 font-normal normal-case tracking-normal text-gris">
                  {new Date(propuesta.official_response_at).toLocaleDateString('es-ES')}
                </span>
              )}
            </p>
            <p className="mt-2 whitespace-pre-line text-[14.5px] text-cuerpo">{propuesta.official_response}</p>
          </div>
        )}

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

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {abierta ? (
            <ApoyoBoton proposalId={propuesta.id} apoyaInicial={apoya} totalInicial={propuesta.support_count} />
          ) : (
            <div className="inline-flex items-center gap-2 rounded-boton border border-linea bg-fondo px-5 py-2.5 text-[14px] text-gris">
              <span aria-hidden>🔒</span>
              Apoyo cerrado —{' '}
              {propuesta.status === 'adopted' || propuesta.status === 'discarded'
                ? 'esta propuesta ya tiene un resultado final'
                : 'la fecha límite de votación ya pasó'}
              <span className="rounded-full bg-black/[.06] px-2 py-0.5 text-[12px]">{propuesta.support_count}</span>
            </div>
          )}
          {user && <SuscripcionBoton proposalId={propuesta.id} siguiendoInicial={siguiendo} />}
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

        {/* D-P5: Polis solo en fase de deliberación estructurada. */}
        {propuesta.status === 'deliberation' && (
          <section className="mt-12">
            <h2 className="text-[20px] font-extrabold text-titular">Deliberación</h2>
            <p className="mt-1.5 text-[14px] text-gris">
              Vota cada afirmación (de acuerdo / paso / en desacuerdo). El resultado agregado es
              siempre público; tu voto individual en una afirmación es solo tuyo.
            </p>
            <div className="mt-5">
              <Deliberacion
                proposalId={propuesta.id}
                filas={filas}
                misVotos={misVotos}
                puedeParticipar={Boolean(user)}
              />
            </div>
          </section>
        )}

        <section className="mt-12">
          <h2 className="text-[20px] font-extrabold text-titular">Comentarios</h2>
          <p className="mt-1.5 text-[14px] text-gris">
            La conversación del día a día del hilo. Siempre activa, en todas las fases.
          </p>
          <div className="mt-5">
            <ComentariosHilo
              proposalId={propuesta.id}
              comentarios={comentarios}
              misLikes={misLikes}
              userId={user?.id ?? null}
              puedeParticipar={Boolean(user)}
            />
          </div>
        </section>

        {!user && (
          <div className="mt-10 text-center">
            <Boton href={`/entrar?next=/propuestas/${propuesta.slug ?? propuesta.id}`} variante="grad">
              Entra para apoyar y comentar
            </Boton>
          </div>
        )}
      </div>
    </Contenedor>
  );
}
