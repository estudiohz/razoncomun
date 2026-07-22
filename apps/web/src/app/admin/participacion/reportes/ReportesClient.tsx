'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { resolverReporteAction } from './actions';
import type { FilaReporte } from '@/lib/participacion/reports';

export function ReportesClient({ filas }: { filas: FilaReporte[] }) {
  const router = useRouter();
  const [pendienteId, setPendienteId] = useState<string | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [, iniciar] = useTransition();

  function resolver(fila: FilaReporte) {
    setErrores((e) => ({ ...e, [fila.id]: '' }));
    setPendienteId(fila.id);
    iniciar(async () => {
      const r = await resolverReporteAction(fila.tipo, fila.proposal_id, fila.comment_id);
      setPendienteId(null);
      if (!r.ok) {
        setErrores((e) => ({ ...e, [fila.id]: r.error ?? 'No se ha podido resolver.' }));
        return;
      }
      router.refresh();
    });
  }

  const abiertos = filas.filter((f) => f.abierto);
  const resueltos = filas.filter((f) => !f.abierto);

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="mb-3 text-[13px] font-bold uppercase tracking-[.08em] text-gris">
          Pendientes ({abiertos.length})
        </h2>
        <div className="overflow-hidden rounded-tarjeta border border-linea bg-white">
          {abiertos.length === 0 && (
            <p className="p-6 text-center text-[13.5px] text-gris">No hay reportes pendientes.</p>
          )}
          <ul>
            {abiertos.map((f) => (
              <li key={f.id} className="flex flex-col gap-2 border-b border-linea/60 p-4 last:border-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="mr-2 rounded-full bg-fondo px-2 py-0.5 text-[11px] font-bold uppercase text-gris ring-1 ring-linea">
                      {f.tipo}
                    </span>
                    <a
                      href={f.enlace}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-titular no-underline hover:underline"
                    >
                      {f.titulo}
                    </a>
                    <p className="mt-1 text-[12.5px] text-gris">
                      Motivo: {f.motivo} · {new Date(f.created_at).toLocaleString('es-ES')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => resolver(f)}
                    disabled={pendienteId === f.id}
                    className="shrink-0 rounded-boton bg-accion px-3 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-60"
                  >
                    {pendienteId === f.id
                      ? 'Resolviendo…'
                      : f.tipo === 'propuesta'
                        ? 'Archivar propuesta'
                        : 'Moderar comentario'}
                  </button>
                </div>
                {errores[f.id] && <p className="text-[12.5px] font-semibold text-magenta">{errores[f.id]}</p>}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {resueltos.length > 0 && (
        <section>
          <h2 className="mb-3 text-[13px] font-bold uppercase tracking-[.08em] text-gris">
            Resueltos ({resueltos.length})
          </h2>
          <div className="overflow-hidden rounded-tarjeta border border-linea bg-white opacity-70">
            <ul>
              {resueltos.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 border-b border-linea/60 p-4 last:border-0">
                  <span className="truncate text-[13px] text-cuerpo">{f.titulo}</span>
                  <span className="shrink-0 text-[11.5px] text-gris">objeto ya moderado</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
