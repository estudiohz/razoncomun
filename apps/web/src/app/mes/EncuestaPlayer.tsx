'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { responderPreguntaAction } from './actions';
import { cn } from '@/lib/cn';
import type { PreguntaMes } from '@/lib/participacion/encuesta-mes';

/**
 * El reproductor de la encuesta del mes. Diseñado pulgar-primero:
 * - Una tarjeta por pregunta, botones de respuesta grandes.
 * - Tocar = guardar al instante (optimista; si el servidor dice no, se
 *   revierte y se explica). No hay "enviar": lo marcado ya cuenta.
 * - "¿Por qué se pregunta esto?" despliega la info ampliada y el enlace a la
 *   propuesta de origen — la trazabilidad del ciclo, a un toque.
 * - Se puede cambiar la respuesta hasta el cierre (0041): tocar otra opción
 *   simplemente la sustituye.
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

  const respondidas = useMemo(
    () => preguntas.filter((p) => respuestas[p.id] !== undefined).length,
    [preguntas, respuestas],
  );

  function responder(pregunta: PreguntaMes, valor: string) {
    const previo = respuestas[pregunta.id];
    // Multiple: alterna el valor dentro del array. Single/scale: sustituye.
    let nuevo: string | string[];
    if (pregunta.kind === 'multiple') {
      const actual = Array.isArray(previo) ? (previo as string[]) : [];
      nuevo = actual.includes(valor) ? actual.filter((v) => v !== valor) : [...actual, valor];
    } else {
      nuevo = valor;
    }

    setError(null);
    setRespuestas((r) => ({ ...r, [pregunta.id]: nuevo }));

    iniciar(async () => {
      const res = await responderPreguntaAction(surveyId, pregunta.id, nuevo);
      if (!res.ok) {
        setRespuestas((r) => ({ ...r, [pregunta.id]: previo }));
        setError(res.error ?? 'No se ha podido guardar.');
        return;
      }
      // ¿Acaba de completar la última? Refrescar trae del servidor la sección
      // de resultados (0043: el marcador es la recompensa por terminar) sin
      // que tenga que recargar a mano.
      const contestadas = new Set(Object.keys(respuestas));
      contestadas.add(pregunta.id);
      if (contestadas.size >= preguntas.length) router.refresh();
    });
  }

  const pct = preguntas.length > 0 ? Math.round((respondidas / preguntas.length) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Progreso pegajoso: siempre sabes por dónde vas y que lo tuyo ya cuenta. */}
      <div className="sticky top-[86px] z-30 rounded-tarjeta border border-linea bg-white/95 px-5 py-3.5 shadow-nav backdrop-blur">
        <div className="flex items-center justify-between text-[13px]">
          <span className="font-bold text-titular">
            {respondidas} de {preguntas.length} respondidas
          </span>
          <span className="text-gris">
            {respondidas === preguntas.length
              ? '¡Completada! Puedes cambiar respuestas hasta el cierre.'
              : 'Lo marcado ya cuenta — sigue cuando quieras.'}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-fondo">
          <div
            className="h-full rounded-full bg-grad transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {error && (
        <p className="rounded-boton bg-magenta/10 px-3.5 py-2.5 text-[13px] font-medium text-magenta">
          {error}
        </p>
      )}

      {preguntas.map((p, i) => {
        const marcada = respuestas[p.id];
        return (
          <article key={p.id} className="rounded-tarjeta border border-linea bg-panel p-5 shadow-nav">
            <p className="text-[12px] font-bold uppercase tracking-wide text-gris">
              Pregunta {i + 1}
              {marcada !== undefined && <span className="ml-2 text-titular">✓ guardada</span>}
            </p>
            <h2 className="mt-1.5 text-[17.5px] font-extrabold leading-snug text-titular">{p.text}</h2>

            <div className="mt-4 flex flex-wrap gap-2.5">
              {(p.options ?? []).map((opcion) => {
                const activa =
                  p.kind === 'multiple'
                    ? Array.isArray(marcada) && (marcada as string[]).includes(opcion)
                    : marcada === opcion;
                return (
                  <button
                    key={opcion}
                    type="button"
                    onClick={() => responder(p, opcion)}
                    aria-pressed={activa}
                    className={cn(
                      'min-h-[48px] flex-1 basis-[calc(50%-6px)] rounded-boton px-4 py-3 text-[14.5px] font-bold transition-colors min-[480px]:basis-auto min-[480px]:flex-none min-[480px]:px-6',
                      activa
                        ? 'bg-accion text-white shadow-boton'
                        : 'border border-linea bg-white text-cuerpo hover:border-titular hover:text-titular',
                    )}
                  >
                    {opcion}
                  </button>
                );
              })}
            </div>

            {(p.info || p.proposal) && (
              <details className="mt-4">
                <summary className="cursor-pointer text-[13px] font-semibold text-titular">
                  ¿Por qué se pregunta esto?
                </summary>
                <div className="mt-2 space-y-2 rounded-boton bg-fondo px-4 py-3">
                  {p.info && (
                    <p className="whitespace-pre-line text-[13.5px] text-cuerpo">{p.info}</p>
                  )}
                  {p.proposal && (
                    <Link
                      href={`/propuestas/${p.proposal.slug ?? p.proposal_id}`}
                      className="inline-block text-[13px] font-bold text-titular underline"
                    >
                      Ver la propuesta, la discusión y los apoyos →
                    </Link>
                  )}
                </div>
              </details>
            )}
          </article>
        );
      })}

      <p className="text-center text-[12.5px] text-gris">
        Puedes cambiar cualquier respuesta hasta el{' '}
        {new Date(cierra).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}. Después,
        el resultado se publica y queda sellado.
      </p>
    </div>
  );
}
