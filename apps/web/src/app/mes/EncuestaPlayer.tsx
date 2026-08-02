'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { responderPreguntaAction } from './actions';
import { cn } from '@/lib/cn';
import type { PreguntaMes } from '@/lib/participacion/encuesta-mes';

/**
 * Reproductor de la encuesta del mes en modo ASISTENTE (propuesta de Sergio,
 * 02/08/2026: "1 pregunta a pantalla completa... quizás sea más intuitivo" —
 * sí, con dos matices que ahorran toques):
 *
 * - Como cada toque GUARDA al instante, en respuesta única no hay botón
 *   "Siguiente": respondes y avanza solo (~300ms para ver tu selección).
 *   En múltiple sí hay "Siguiente" (no se sabe cuándo has terminado de marcar).
 * - "Omitir" y "Siguiente" son el mismo botón con etiqueta contextual:
 *   Omitir si no has respondido, Siguiente si sí, Terminar en la última.
 *
 * Al final, un RESUMEN con todas tus respuestas desde el que saltar a
 * cualquier pregunta para cambiarla (editable hasta el cierre, 0041). El
 * guardado sigue siendo por respuesta: abandonar a mitad deja lo marcado
 * contado, como siempre.
 */
export function EncuestaPlayer({
  surveyId,
  preguntas,
  respuestasIniciales,
  cierra,
}: {
  surveyId: string;
  preguntas: PreguntaMes[];
  respuestasIniciales: Record<string, unknown>;
  cierra: string;
}) {
  const router = useRouter();
  const [respuestas, setRespuestas] = useState<Record<string, unknown>>(respuestasIniciales);
  const [error, setError] = useState<string | null>(null);
  const [, iniciar] = useTransition();
  // Arranca en la primera SIN responder (retomar donde lo dejaste); si están
  // todas, directamente en el resumen.
  const [indice, setIndice] = useState(() => {
    const primera = preguntas.findIndex((p) => respuestasIniciales[p.id] === undefined);
    return primera === -1 ? preguntas.length : primera;
  });
  const avanceAuto = useRef<ReturnType<typeof setTimeout> | null>(null);

  const respondidas = useMemo(
    () => preguntas.filter((p) => respuestas[p.id] !== undefined).length,
    [preguntas, respuestas],
  );
  const total = preguntas.length;
  const enResumen = indice >= total;
  const pregunta = enResumen ? null : preguntas[indice];

  function guardar(p: PreguntaMes, nuevo: string | string[], previo: unknown) {
    setError(null);
    setRespuestas((r) => ({ ...r, [p.id]: nuevo }));
    iniciar(async () => {
      const res = await responderPreguntaAction(surveyId, p.id, nuevo);
      if (!res.ok) {
        setRespuestas((r) => ({ ...r, [p.id]: previo }));
        setError(res.error ?? 'No se ha podido guardar.');
        return;
      }
      const contestadas = new Set(Object.keys(respuestas));
      contestadas.add(p.id);
      if (contestadas.size >= total) router.refresh();
    });
  }

  function responder(p: PreguntaMes, valor: string) {
    const previo = respuestas[p.id];
    if (p.kind === 'multiple') {
      const actual = Array.isArray(previo) ? (previo as string[]) : [];
      guardar(p, actual.includes(valor) ? actual.filter((v) => v !== valor) : [...actual, valor], previo);
      return;
    }
    guardar(p, valor, previo);
    // Respuesta única: avanza solo — el "Siguiente" sería un toque de más.
    if (avanceAuto.current) clearTimeout(avanceAuto.current);
    avanceAuto.current = setTimeout(() => setIndice((i) => Math.min(i + 1, total)), 300);
  }

  const pct = total > 0 ? Math.round((respondidas / total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Progreso */}
      <div className="rounded-tarjeta border border-linea bg-white/95 px-5 py-3.5 shadow-nav">
        <div className="flex items-center justify-between text-[13px]">
          <span className="font-bold text-titular">
            {enResumen ? `${respondidas} de ${total} respondidas` : `Pregunta ${indice + 1} de ${total}`}
          </span>
          <span className="text-gris">Lo marcado ya cuenta</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-fondo">
          <div className="h-full rounded-full bg-grad transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {error && (
        <p className="rounded-boton bg-magenta/10 px-3.5 py-2.5 text-[13px] font-medium text-magenta">{error}</p>
      )}

      {/* Una pregunta a pantalla (casi) completa */}
      {pregunta && (
        <article className="rounded-tarjeta border border-linea bg-panel p-5 shadow-nav min-[480px]:p-6">
          <h2 className="text-[19px] font-extrabold leading-snug text-titular min-[480px]:text-[21px]">
            {pregunta.text}
          </h2>
          {pregunta.kind === 'multiple' && (
            <p className="mt-1 text-[12.5px] text-gris">Puedes marcar varias.</p>
          )}

          <div className={cn('mt-5', pregunta.kind === 'multiple' ? 'flex flex-col gap-2' : 'flex flex-col gap-2 min-[480px]:flex-row min-[480px]:flex-wrap')}>
            {(pregunta.options ?? []).map((opcion) => {
              const marcada = respuestas[pregunta.id];
              const activa =
                pregunta.kind === 'multiple'
                  ? Array.isArray(marcada) && (marcada as string[]).includes(opcion)
                  : marcada === opcion;
              return (
                <button
                  key={opcion}
                  type="button"
                  onClick={() => responder(pregunta, opcion)}
                  aria-pressed={activa}
                  className={cn(
                    'flex min-h-[52px] items-center gap-3 rounded-boton px-4 py-3 text-left text-[15px] font-bold transition-colors',
                    pregunta.kind === 'multiple' ? 'w-full' : 'w-full min-[480px]:w-auto min-[480px]:px-6',
                    activa
                      ? 'bg-accion text-white shadow-boton'
                      : 'border border-linea bg-white text-cuerpo hover:border-titular hover:text-titular',
                  )}
                >
                  {pregunta.kind === 'multiple' && (
                    <span
                      aria-hidden
                      className={cn(
                        'grid h-5 w-5 shrink-0 place-items-center rounded-[6px] border-2 text-[12px]',
                        activa ? 'border-white bg-white/20' : 'border-linea',
                      )}
                    >
                      {activa ? '✓' : ''}
                    </span>
                  )}
                  {opcion}
                </button>
              );
            })}
          </div>

          {(pregunta.info || pregunta.proposal) && (
            <details className="mt-5">
              <summary className="cursor-pointer text-[13px] font-semibold text-titular">
                ¿Por qué se pregunta esto?
              </summary>
              <div className="mt-2 space-y-2 rounded-boton bg-fondo px-4 py-3">
                {pregunta.info && (
                  <p className="whitespace-pre-line text-[13.5px] text-cuerpo">{pregunta.info}</p>
                )}
                {pregunta.proposal && (
                  <Link
                    href={`/propuestas/${pregunta.proposal.slug ?? pregunta.proposal_id}`}
                    className="inline-block text-[13px] font-bold text-titular underline"
                  >
                    Ver la propuesta, la discusión y los apoyos →
                  </Link>
                )}
              </div>
            </details>
          )}
        </article>
      )}

      {/* Resumen final: repaso y salto para cambiar cualquiera */}
      {enResumen && (
        <article className="rounded-tarjeta border border-linea bg-panel p-5 shadow-nav min-[480px]:p-6">
          <h2 className="text-[19px] font-extrabold text-titular">
            {respondidas === total ? '¡Encuesta completada!' : 'Tu repaso'}
          </h2>
          <p className="mt-1 text-[13.5px] text-cuerpo">
            {respondidas === total
              ? 'Gracias por participar. Abajo tienes cómo van los resultados.'
              : `Has respondido ${respondidas} de ${total}. Lo marcado ya cuenta; puedes completar las que faltan cuando quieras.`}
          </p>
          {respondidas < total && (
            <button
              type="button"
              onClick={() => {
                const primera = preguntas.findIndex((p) => respuestas[p.id] === undefined);
                if (primera !== -1) setIndice(primera);
              }}
              className="mt-4 w-full rounded-boton bg-accion px-5 py-3 text-[14px] font-bold text-white shadow-boton"
            >
              Responder las que faltan ({total - respondidas})
            </button>
          )}
          <ul className="mt-4 space-y-2">
            {preguntas.map((p, i) => {
              const r = respuestas[p.id];
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setIndice(i)}
                    className="flex w-full items-baseline justify-between gap-3 rounded-boton border border-linea bg-white px-4 py-2.5 text-left hover:border-titular"
                  >
                    <span className="min-w-0 truncate text-[13.5px] font-semibold text-cuerpo">
                      {i + 1}. {p.text}
                    </span>
                    <span className={cn('shrink-0 text-[12.5px] font-bold', r === undefined ? 'text-magenta' : 'text-titular')}>
                      {r === undefined ? 'Sin responder' : Array.isArray(r) ? (r as string[]).join(', ') || 'Sin responder' : String(r)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </article>
      )}

      {/* Controles: Anterior + botón contextual (Omitir/Siguiente/Terminar) */}
      {!enResumen && (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={indice === 0}
            onClick={() => setIndice((i) => Math.max(i - 1, 0))}
            className="rounded-boton border border-linea bg-white px-5 py-3 text-[14px] font-bold text-cuerpo disabled:opacity-40"
          >
            ← Anterior
          </button>
          <button
            type="button"
            onClick={() => setIndice((i) => Math.min(i + 1, total))}
            className={cn(
              'rounded-boton px-6 py-3 text-[14px] font-bold',
              respuestas[pregunta!.id] === undefined
                ? 'border border-linea bg-white text-cuerpo'
                : 'bg-accion text-white shadow-boton',
            )}
          >
            {respuestas[pregunta!.id] === undefined
              ? 'Omitir'
              : indice === total - 1
                ? 'Terminar'
                : 'Siguiente →'}
          </button>
        </div>
      )}

      <p className="text-center text-[12.5px] text-gris">
        Puedes cambiar cualquier respuesta hasta el{' '}
        {new Date(cierra).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}.
      </p>
    </div>
  );
}
