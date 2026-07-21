/**
 * app/pais/[slug]/BarraSueldos.tsx
 *
 * "Sueldo medio por tipo de profesional" (D-S11, docs/tecnico/
 * simulador-pais.md §9) — segundo gráfico obligatorio del panel de
 * ministerio. NO es un donut: un sueldo no es una porción de un todo, así
 * que se reutiliza el estilo visual de barra ya usado en `FilaPartida`
 * (actual/RC) — una sola barra por profesión, ancho relativo al sueldo
 * MÁXIMO del sector. Presentacional, sin estado.
 */

import type { DemografiaRow } from '@/lib/simulador/adminData';
import { formatoEurosConUnidad } from '@/lib/simulador/formato';

export function BarraSueldos({ filas }: { filas: DemografiaRow[] }) {
  const conValor = filas.filter((f): f is DemografiaRow & { valor_medio_cents: number } => f.valor_medio_cents !== null);
  if (conValor.length === 0) return null;

  const maxCents = Math.max(...conValor.map((f) => f.valor_medio_cents));

  return (
    <div className="rounded-boton border border-linea bg-white p-4">
      <p className="mb-3 text-[11.5px] font-bold uppercase tracking-wide text-gris">
        Sueldo medio por tipo de profesional
      </p>
      <div className="space-y-2.5">
        {conValor.map((f) => {
          const pct = maxCents > 0 ? Math.min(100, (f.valor_medio_cents / maxCents) * 100) : 0;
          return (
            <div key={f.id} className="flex items-center gap-2">
              <span className="w-28 shrink-0 truncate text-[12.5px] font-semibold text-cuerpo min-[480px]:w-40">
                {f.nombre}
              </span>
              <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-fondo">
                <div
                  className="h-full rounded-full bg-teal transition-[width] duration-500 ease-out"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-24 shrink-0 text-right text-[12.5px] font-semibold tabular-nums text-titular">
                {formatoEurosConUnidad(f.valor_medio_cents, f.unidad_valor_medio)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
