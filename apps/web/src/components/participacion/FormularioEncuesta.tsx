'use client';

import { useState, useTransition } from 'react';
import { responderEncuestaAction } from '@/app/encuestas/actions';
import type { SurveyQuestion } from '@/lib/participacion/types';

export function FormularioEncuesta({ surveyId, preguntas }: { surveyId: string; preguntas: SurveyQuestion[] }) {
  const [respuestas, setRespuestas] = useState<Record<string, unknown>>({});
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [pendiente, iniciarTransicion] = useTransition();

  function enviar() {
    iniciarTransicion(async () => {
      const resultado = await responderEncuestaAction(surveyId, respuestas);
      setMensaje(resultado.mensaje);
    });
  }

  const completo = preguntas.every((p) => respuestas[p.id] !== undefined && respuestas[p.id] !== '');

  return (
    <div className="space-y-6">
      {preguntas.map((p) => (
        <div key={p.id} className="rounded-tarjeta border border-linea bg-panel p-5">
          <p className="text-[14.5px] font-semibold text-titular">{p.text}</p>
          <div className="mt-3">
            {p.kind === 'single' && (
              <div className="space-y-2">
                {(p.options?.options ?? []).map((opcion) => (
                  <label key={opcion} className="flex items-center gap-2.5 text-[13.5px] text-cuerpo">
                    <input
                      type="radio"
                      name={p.id}
                      value={opcion}
                      onChange={() => setRespuestas((prev) => ({ ...prev, [p.id]: opcion }))}
                      className="h-4 w-4 text-accion"
                    />
                    {opcion}
                  </label>
                ))}
              </div>
            )}
            {p.kind === 'multiple' && (
              <div className="space-y-2">
                {(p.options?.options ?? []).map((opcion) => (
                  <label key={opcion} className="flex items-center gap-2.5 text-[13.5px] text-cuerpo">
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        setRespuestas((prev) => {
                          const actuales = Array.isArray(prev[p.id]) ? (prev[p.id] as string[]) : [];
                          const siguientes = e.target.checked
                            ? [...actuales, opcion]
                            : actuales.filter((o) => o !== opcion);
                          return { ...prev, [p.id]: siguientes };
                        });
                      }}
                      className="h-4 w-4 text-accion"
                    />
                    {opcion}
                  </label>
                ))}
              </div>
            )}
            {p.kind === 'scale' && (
              <div className="flex gap-2">
                {Array.from({ length: (p.options?.max ?? 5) - (p.options?.min ?? 1) + 1 }, (_, i) => (p.options?.min ?? 1) + i).map(
                  (valor) => (
                    <button
                      key={valor}
                      type="button"
                      onClick={() => setRespuestas((prev) => ({ ...prev, [p.id]: valor }))}
                      className={`h-10 w-10 rounded-full border text-[14px] font-bold ${
                        respuestas[p.id] === valor ? 'border-accion bg-accion text-white' : 'border-linea bg-white text-titular'
                      }`}
                    >
                      {valor}
                    </button>
                  ),
                )}
              </div>
            )}
            {p.kind === 'text' && (
              <textarea
                rows={3}
                onChange={(e) => setRespuestas((prev) => ({ ...prev, [p.id]: e.target.value }))}
                className="w-full rounded-boton border border-linea px-4 py-2.5 text-[14px]"
              />
            )}
          </div>
        </div>
      ))}

      <button
        type="button"
        disabled={!completo || pendiente}
        onClick={enviar}
        className="rounded-boton bg-accion px-6 py-3 text-[14px] font-bold text-white shadow-boton disabled:opacity-50"
      >
        {pendiente ? 'Enviando…' : 'Enviar respuestas'}
      </button>

      {mensaje && <p className="text-[13.5px] font-semibold text-titular">{mensaje}</p>}
    </div>
  );
}
