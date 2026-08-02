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
import { TiraDeslizable } from '@/components/ui/TiraDeslizable';
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

  // ¿Este usuario ha completado todas las preguntas?
  const completada =
    Boolean(encuesta && user) &&
    encuesta!.preguntas.length > 0 &&
    encuesta!.misRespuestas.size >= encuesta!.preguntas.length;

  // El RPC (0043) es la autoridad: en on_close+abierta solo devuelve datos a
  // quien completó. Aquí solo se decide si merece la pena llamarlo.
  const resultados =
    encuesta && (!encuesta.abierta || encuesta.results_visibility === 'live' || completada)
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

      {/* Cinta de meses: el registro anual. TiraDeslizable compartida (una
          fila con flechas ‹ › en móvil, wrap centrado en escritorio) — mismo
          gesto que blog y propuestas. */}
      <div className="mt-7 min-[720px]:mx-auto min-[720px]:max-w-[820px]">
        <TiraDeslizable alinear="centro">
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
                  'shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-bold no-underline transition-colors min-[720px]:shrink',
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
        </TiraDeslizable>
      </div>

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

        {/* Encuesta CERRADA con sesión: recordatorio de solo-lectura. Lo que
            respondió cada uno se marca dentro de las barras de abajo. */}
        {encuesta && !encuesta.abierta && user && encuesta.misRespuestas.size > 0 && (
          <p className="rounded-tarjeta border border-linea bg-panel px-5 py-3.5 text-[13.5px] text-cuerpo">
            Respondiste {encuesta.misRespuestas.size} de {encuesta.preguntas.length} pregunta
            {encuesta.preguntas.length === 1 ? '' : 's'}. Tu respuesta aparece marcada en cada
            resultado — la encuesta está cerrada y ya no puede editarse.
          </p>
        )}

        {/* Resultados: cerrada, en vivo, o como recompensa por completar (0043) */}
        {encuesta && resultados.length > 0 && (
          <section className="mt-8">
            <h2 className="text-[20px] font-extrabold text-titular">
              {!encuesta.abierta
                ? 'Resultados'
                : completada && encuesta.results_visibility !== 'live'
                  ? 'Así van los resultados — gracias por completarla'
                  : 'Resultados en directo'}
            </h2>
            <p className="mt-1 text-[13px] text-gris">
              El voto de los simpatizantes se publica junto al de los afiliados — así lo dice
              nuestro ideario. Afiliados en teal, simpatizantes en gris.
              {encuesta.abierta && completada && ' El marcador puede seguir moviéndose hasta el cierre.'}
            </p>
            <div className="mt-4 space-y-5">
              {encuesta.preguntas.map((p) => (
                <ResultadoPregunta
                  key={p.id}
                  pregunta={p}
                  filas={resultados.filter((r) => r.question_id === p.id)}
                  miRespuesta={encuesta.misRespuestas.get(p.id) ?? null}
                />
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

/**
 * Resultados de una pregunta al estilo clásico de encuesta (rediseño pedido
 * por Sergio, 02/08/2026: "las típicas barras respecto al 100%"):
 *
 * - El PORCENTAJE sobre el total de votos de la pregunta manda: número grande
 *   y ancho de barra = ese %. Antes la barra se escalaba contra la opción más
 *   votada, que no es lo que espera nadie de una encuesta.
 * - TODAS las opciones de la pregunta aparecen, también las de 0% — el
 *   agregado solo trae lo votado, así que se parte de `pregunta.options` y se
 *   mezcla (una opción con 0 votos que desaparece parece un error, no un 0).
 * - La segmentación afiliados/simpatizantes se conserva DENTRO de la barra
 *   (teal/gris proporcional) y en el detalle pequeño; el % es del total.
 *
 * Server component, sin JS. `miRespuesta` chip "Tu respuesta" (vista de solo
 * lectura al cierre y acompañante del marcador al completar).
 */
function ResultadoPregunta({
  pregunta,
  filas,
  miRespuesta,
}: {
  pregunta: { text: string; options: string[] | null };
  filas: ResultadoOpcion[];
  miRespuesta: unknown;
}) {
  const porOpcion = new Map(filas.map((f) => [f.option_value, f]));
  // Las opciones definidas mandan el orden; cualquier valor extra del
  // agregado (texto libre, opciones antiguas) se añade detrás.
  const opciones = [
    ...(pregunta.options ?? []),
    ...filas.map((f) => f.option_value).filter((v) => !(pregunta.options ?? []).includes(v)),
  ];
  const totalPregunta = filas.reduce((a, f) => a + f.afiliados + f.simpatizantes, 0);
  const esMia = (opcion: string) =>
    Array.isArray(miRespuesta) ? (miRespuesta as string[]).includes(opcion) : miRespuesta === opcion;

  return (
    <div className="rounded-tarjeta border border-linea bg-panel p-5">
      <h3 className="text-[15px] font-extrabold text-titular">{pregunta.text}</h3>
      <p className="mt-0.5 text-[12px] text-gris">
        {totalPregunta} voto{totalPregunta === 1 ? '' : 's'}
      </p>
      <div className="mt-3 space-y-3">
        {opciones.map((opcion) => {
          const f = porOpcion.get(opcion);
          const afiliados = f?.afiliados ?? 0;
          const simpatizantes = f?.simpatizantes ?? 0;
          const total = afiliados + simpatizantes;
          const pct = totalPregunta > 0 ? Math.round((total / totalPregunta) * 100) : 0;
          return (
            <div key={opcion}>
              <div className="flex items-baseline justify-between gap-2 text-[13.5px]">
                <span className="min-w-0 font-semibold text-cuerpo">
                  {opcion}
                  {esMia(opcion) && (
                    <span className="ml-2 rounded-full bg-accion px-2 py-0.5 text-[10.5px] font-bold text-white">
                      Tu respuesta
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-[16px] font-extrabold tabular-nums text-titular">
                  {pct}%
                </span>
              </div>
              <div className="mt-1 flex h-3.5 overflow-hidden rounded-full bg-fondo">
                {total > 0 && (
                  <>
                    <div
                      className="h-full bg-teal"
                      style={{ width: `${(afiliados / totalPregunta) * 100}%` }}
                    />
                    <div
                      className="h-full bg-linea"
                      style={{ width: `${(simpatizantes / totalPregunta) * 100}%` }}
                    />
                  </>
                )}
              </div>
              <p className="mt-0.5 text-[11.5px] text-gris">
                {total} voto{total === 1 ? '' : 's'} · {afiliados} afil. / {simpatizantes} simp.
              </p>
            </div>
          );
        })}
        {opciones.length === 0 && <p className="text-[13px] text-gris">Sin respuestas registradas.</p>}
      </div>
    </div>
  );
}
