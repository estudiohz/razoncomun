import type { Metadata } from 'next';
import Link from 'next/link';
import { Contenedor } from '@/components/layout/Contenedor';
import { EstadoBadge } from '@/components/participacion/EstadoBadge';
import { metadatosPagina } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';
import {
  obtenerEncuestaDelMes,
  resultadosEncuesta,
  type ResultadoOpcion,
} from '@/lib/participacion/encuesta-mes';
import { EncuestaPlayer } from './EncuestaPlayer';
import { cn } from '@/lib/cn';
import type { Propuesta } from '@/lib/participacion/types';

export const metadata: Metadata = metadatosPagina({
  titulo: 'La encuesta del mes',
  descripcion:
    'Responde la encuesta del mes en dos minutos: preguntas nacidas de propuestas ciudadanas, con su discusión enlazada. Al final del año, el registro completo queda aquí.',
  ruta: '/mes',
});

export const dynamic = 'force-dynamic';

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/**
 * El centro de la app (E1-E3, 02/08/2026). Si el mes tiene encuesta (0041),
 * ella lidera: reproductor con guardado por toque para quien puede responder,
 * resultados segmentados afiliados/simpatizantes cuando la visibilidad lo
 * permite, y un aterrizaje de registro para el anónimo (la RLS ya le oculta
 * la encuesta; aquí se le cuenta qué se pierde). Las propuestas fijadas del
 * mes (0040) quedan como sección secundaria.
 *
 * `dynamic` y no ISR: el reproductor pinta TUS respuestas — cachear la página
 * mezclaría el progreso de un usuario con el de otro.
 */
export default async function MesPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ahora = new Date();
  const mesActual = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
  const mes = m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m) ? m : mesActual;
  const [anyo, numMes] = mes.split('-').map(Number);

  const [encuesta, { data: fijadas }, { data: delAnyo }] = await Promise.all([
    obtenerEncuestaDelMes(supabase, mes, user?.id ?? null),
    supabase
      .from('proposals')
      .select('id, title, slug, status, support_count')
      .eq('featured_month', `${mes}-01`)
      .order('support_count', { ascending: false }),
    supabase
      .from('surveys')
      .select('featured_month')
      .gte('featured_month', `${anyo}-01-01`)
      .lte('featured_month', `${anyo}-12-01`),
  ]);

  const resultados =
    encuesta && (!encuesta.abierta || encuesta.results_visibility === 'live')
      ? await resultadosEncuesta(supabase, encuesta.id)
      : [];

  const mesesConEncuesta = new Set((delAnyo ?? []).map((s) => s.featured_month?.slice(0, 7)));
  const esActual = mes === mesActual;
  const pinned = (fijadas ?? []) as Pick<Propuesta, 'id' | 'title' | 'slug' | 'status' | 'support_count'>[];

  return (
    <Contenedor as="section" className="py-10 min-[720px]:py-14">
      <header className="mx-auto max-w-[720px] text-center">
        <span className="text-[13px] font-bold uppercase tracking-[.14em] text-titular">
          {esActual ? 'Participa ahora' : 'Histórico'}
        </span>
        <h1 className="mt-2 text-[clamp(26px,4.4vw,40px)] font-extrabold leading-[1.12]">
          {encuesta ? encuesta.title : `La encuesta de ${MESES[numMes - 1]} ${anyo}`}
        </h1>
        {encuesta?.description && (
          <p className="mx-auto mt-3 max-w-[560px] text-[14.5px] text-cuerpo">{encuesta.description}</p>
        )}
      </header>

      {/* Cinta de meses: el registro anual. */}
      <nav aria-label="Meses del año" className="mx-auto mt-7 flex max-w-[820px] flex-wrap justify-center gap-2">
        {MESES.map((nombre, i) => {
          const k = `${anyo}-${String(i + 1).padStart(2, '0')}`;
          const activo = k === mes;
          const tiene = mesesConEncuesta.has(k);
          if (k > mesActual && !tiene) return null;
          return (
            <Link
              key={k}
              href={`/mes?m=${k}`}
              aria-current={activo ? 'page' : undefined}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-[12.5px] font-bold no-underline transition-colors',
                activo
                  ? 'bg-accion text-white'
                  : tiene
                    ? 'bg-white text-titular ring-1 ring-linea hover:ring-titular'
                    : 'bg-fondo text-gris',
              )}
            >
              {nombre.slice(0, 3)}
            </Link>
          );
        })}
      </nav>

      <div className="mx-auto mt-8 max-w-[640px]">
        {/* Caso 1: hay encuesta y puedo responderla */}
        {encuesta && encuesta.abierta && user && (
          <EncuestaPlayer
            surveyId={encuesta.id}
            preguntas={encuesta.preguntas}
            respuestasIniciales={Object.fromEntries(encuesta.misRespuestas)}
            cierra={encuesta.closes_at}
          />
        )}

        {/* Caso 2: hay encuesta pero soy anónimo → el funnel */}
        {encuesta && encuesta.abierta && !user && (
          <div className="rounded-tarjeta border border-teal/40 bg-teal/[.06] p-7 text-center">
            <p className="text-[15px] font-bold text-titular">
              {encuesta.preguntas.length} pregunta{encuesta.preguntas.length === 1 ? '' : 's'} · 2 minutos
            </p>
            <p className="mx-auto mt-2 max-w-[46ch] text-[14px] text-cuerpo">
              Cada pregunta nace de una propuesta ciudadana debatida y votada. Crea una cuenta
              gratuita con tu email y tu opinión queda contada — se publica junto a la de los
              afiliados.
            </p>
            <Link
              href={`/registro?next=${encodeURIComponent('/mes')}`}
              className="mt-4 inline-block rounded-boton bg-accion px-6 py-3 text-[14.5px] font-bold text-white no-underline shadow-boton"
            >
              Crear cuenta y responder
            </Link>
            <p className="mt-3 text-[12.5px] text-gris">
              ¿Ya tienes cuenta?{' '}
              <Link href={`/entrar?next=${encodeURIComponent('/mes')}`} className="font-semibold text-titular underline">
                Entra
              </Link>
            </p>
          </div>
        )}

        {/* Caso 3: sin encuesta este mes */}
        {!encuesta && (
          <p className="rounded-tarjeta border border-linea bg-panel p-8 text-center text-[14.5px] text-gris">
            {esActual
              ? 'La encuesta de este mes todavía no está publicada. El tablero de propuestas está siempre abierto.'
              : 'Este mes no tuvo encuesta.'}
          </p>
        )}

        {/* Resultados (cerrada, o en vivo si la visibilidad lo permite) */}
        {encuesta && resultados.length > 0 && (
          <section className="mt-8">
            <h2 className="text-[20px] font-extrabold text-titular">
              {encuesta.abierta ? 'Resultados en directo' : 'Resultados'}
            </h2>
            <p className="mt-1 text-[13px] text-gris">
              El voto de los simpatizantes se publica junto al de los afiliados — así lo dice
              nuestro ideario. Afiliados en teal, simpatizantes en gris.
            </p>
            <div className="mt-4 space-y-5">
              {encuesta.preguntas.map((p) => (
                <ResultadoPregunta key={p.id} pregunta={p.text} filas={resultados.filter((r) => r.question_id === p.id)} />
              ))}
            </div>
          </section>
        )}
      </div>

      {pinned.length > 0 && (
        <section className="mx-auto mt-12 max-w-[640px]">
          <h2 className="text-[17px] font-extrabold text-titular">También destacadas este mes</h2>
          <div className="mt-4 grid gap-3">
            {pinned.map((p) => (
              <Link
                key={p.id}
                href={`/propuestas/${p.slug ?? p.id}`}
                className="flex items-center justify-between gap-3 rounded-tarjeta border border-linea bg-panel p-4 no-underline hover:border-titular"
              >
                <span className="min-w-0">
                  <EstadoBadge status={p.status} className="mb-1.5" />
                  <span className="block truncate text-[15px] font-bold text-titular">{p.title}</span>
                </span>
                <span className="shrink-0 text-[12.5px] text-gris">👍 {p.support_count}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <p className="mx-auto mt-12 max-w-[560px] text-center text-[13px] text-gris">
        Las decisiones cerradas, con sus informes y actas, están en{' '}
        <Link href="/cambios" className="font-semibold text-titular underline">
          Qué cambió gracias a ti
        </Link>
        .
      </p>
    </Contenedor>
  );
}

/** Barras horizontales por opción, afiliados vs simpatizantes. Server, sin JS. */
function ResultadoPregunta({ pregunta, filas }: { pregunta: string; filas: ResultadoOpcion[] }) {
  const max = Math.max(1, ...filas.map((f) => f.afiliados + f.simpatizantes));
  return (
    <div className="rounded-tarjeta border border-linea bg-panel p-5">
      <h3 className="text-[15px] font-extrabold text-titular">{pregunta}</h3>
      <div className="mt-3 space-y-2.5">
        {filas
          .slice()
          .sort((a, b) => b.afiliados + b.simpatizantes - (a.afiliados + a.simpatizantes))
          .map((f) => {
            const total = f.afiliados + f.simpatizantes;
            return (
              <div key={f.option_value}>
                <div className="flex items-baseline justify-between text-[13px]">
                  <span className="font-semibold text-cuerpo">{f.option_value}</span>
                  <span className="text-gris">
                    {total} · {f.afiliados} afil. / {f.simpatizantes} simp.
                  </span>
                </div>
                <div className="mt-1 flex h-3 overflow-hidden rounded-full bg-fondo">
                  <div className="h-full bg-teal" style={{ width: `${(f.afiliados / max) * 100}%` }} />
                  <div className="h-full bg-linea" style={{ width: `${(f.simpatizantes / max) * 100}%` }} />
                </div>
              </div>
            );
          })}
        {filas.length === 0 && <p className="text-[13px] text-gris">Sin respuestas registradas.</p>}
      </div>
    </div>
  );
}
