'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import type { PartidaRow } from '@/lib/simulador/adminData';
import { formatoCorto } from '@/lib/simulador/formato';
import type { PartidaResueltaInfo } from '@/lib/simulador/tipos';

/**
 * app/pais/TopIngresos.tsx
 *
 * "Ingreso total del Estado" — lo primero que ve el visitante tras el
 * titular (justo después de la Cabecera, antes de los bloques Gastos|
 * Ingresos), pedido por Sergio viendo el panel en vivo (S2.1).
 *
 * IMPORTANTE (para quien lea esto en el admin): esto NO fabrica ningún
 * dato. Lista las partidas de ingreso ya existentes en la BD (las
 * sembradas y publicadas por el equipo) — hojas del árbol (sin hijos),
 * lado ACTUAL/oficial, ordenadas de mayor a menor. Si Sergio quiere un
 * top-20 real y representativo del ingreso público, eso lo rellena el
 * equipo desde `/admin/presupuesto` — este componente solo es el mecanismo
 * de visualización, no la fuente de las cifras.
 */

const ANIO_PRINCIPAL = 2026;
const LIMITE_MOVIL = 5;
const LIMITE_ESCRITORIO = 10;
const LIMITE_MAXIMO = 20;

interface Props {
  partidas: PartidaRow[];
  infoPorId: Map<string, PartidaResueltaInfo>;
}

export function TopIngresos({ partidas, infoPorId }: Props) {
  const [expandido, setExpandido] = useState(false);

  const idsConHijos = new Set(
    partidas.filter((p) => p.parent_id !== null).map((p) => p.parent_id as string),
  );

  const raicesIngreso = partidas.filter((p) => p.tipo === 'ingreso' && p.parent_id === null);
  const totalCents = raicesIngreso.reduce(
    (suma, r) => suma + (infoPorId.get(r.id)?.actual.propioCents ?? 0),
    0,
  );

  const hojasIngreso = partidas
    .filter((p) => p.tipo === 'ingreso' && !idsConHijos.has(p.id))
    .map((p) => ({ partida: p, cents: infoPorId.get(p.id)?.actual.propioCents ?? null }))
    .filter((x): x is { partida: PartidaRow; cents: number } => x.cents !== null && x.cents > 0)
    .sort((a, b) => b.cents - a.cents)
    .slice(0, LIMITE_MAXIMO);

  if (hojasIngreso.length === 0) return null;

  const maxCents = hojasIngreso[0].cents;
  const aniosDistintos = new Set(hojasIngreso.map((x) => x.partida.anio));
  const mostrarBoton = hojasIngreso.length > LIMITE_MOVIL;

  return (
    <section className="mx-auto mt-8 max-w-[1080px] rounded-tarjeta border border-linea bg-white p-5 min-[720px]:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[15px] font-extrabold uppercase tracking-wide text-titular">
          Ingreso total del Estado
        </h2>
        <p className="text-[22px] font-extrabold tabular-nums text-titular">{formatoCorto(totalCents)}</p>
      </div>
      <p className="mt-1 text-[12.5px] text-cuerpo">
        Las partidas de ingreso publicadas, de mayor a menor (valor oficial).
      </p>

      <ul className="mt-4 space-y-2">
        {hojasIngreso.map(({ partida, cents }, i) => {
          const pct = maxCents > 0 ? Math.min(100, (cents / maxCents) * 100) : 0;
          const mostrarAnio = partida.anio !== ANIO_PRINCIPAL || aniosDistintos.size > 1;

          return (
            <li
              key={partida.id}
              className={cn(
                'flex items-center gap-3',
                !expandido && i >= LIMITE_ESCRITORIO && 'hidden',
                !expandido && i >= LIMITE_MOVIL && i < LIMITE_ESCRITORIO && 'hidden min-[720px]:flex',
              )}
            >
              <span className="w-[38%] shrink-0 truncate text-[13px] font-semibold text-cuerpo min-[520px]:w-[30%]">
                {partida.nombre}
                {mostrarAnio && (
                  <span className="ml-1.5 rounded-full bg-fondo px-1.5 py-0.5 text-[10px] font-bold text-gris">
                    {partida.anio}
                  </span>
                )}
              </span>
              <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-fondo">
                <div
                  className="h-full rounded-full bg-teal transition-[width] duration-500 ease-out"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-20 shrink-0 text-right text-[12.5px] font-semibold tabular-nums text-titular">
                {formatoCorto(cents)}
              </span>
            </li>
          );
        })}
      </ul>

      {mostrarBoton && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setExpandido((v) => !v)}
            className="rounded-boton border border-linea bg-white px-4 py-2 text-[13px] font-bold text-titular hover:border-titular"
          >
            {expandido ? 'Ver menos ▲' : 'Ver más ▼'}
          </button>
        </div>
      )}
    </section>
  );
}
