/**
 * app/pais/PiramidePoblacional.tsx
 *
 * Gráfico piramidal (pedido por Sergio): compara Población activa vs
 * Jubilados para visualizar quién sostiene las pensiones — la pregunta de
 * sostenibilidad del sistema. Dos barras espejadas sobre un eje central
 * (la forma clásica de una pirámide poblacional, aquí con dos categorías en
 * vez de bandas de edad), más el ratio como titular ("X,X activos por cada
 * jubilado"), que es el dato realmente accionable.
 *
 * Puramente presentacional (D-S13: informativo, sin lado Razón Común). Si
 * falta cualquiera de las dos filas (`activa`/`jubilados` no publicadas o
 * sin dato), no se renderiza nada — no se fabrica el ratio con datos a medias.
 */

import type { DemografiaRow } from '@/lib/simulador/adminData';
import { formatoPersonas } from '@/lib/simulador/formato';

interface Props {
  activa: DemografiaRow | undefined;
  jubilados: DemografiaRow | undefined;
}

export function PiramidePoblacional({ activa, jubilados }: Props) {
  if (!activa || !jubilados || activa.num_personas <= 0 || jubilados.num_personas <= 0) return null;

  const max = Math.max(activa.num_personas, jubilados.num_personas);
  const pctActiva = (activa.num_personas / max) * 100;
  const pctJubilados = (jubilados.num_personas / max) * 100;
  const ratio = activa.num_personas / jubilados.num_personas;

  return (
    <div className="mt-5 border-t border-linea pt-4">
      <p className="mb-1 text-[11.5px] font-bold uppercase tracking-wide text-gris">
        ¿Quién sostiene las pensiones?
      </p>
      <p className="text-[15px] font-extrabold text-titular">
        {ratio.toLocaleString('es-ES', { maximumFractionDigits: 1, useGrouping: 'always' })} personas activas por
        cada jubilado
      </p>

      <div className="mt-4 space-y-2">
        {/* Fila 1: Población activa — barra crece hacia la IZQUIERDA desde el eje central */}
        <div className="flex items-center gap-3">
          <div className="flex h-6 flex-1 items-center justify-end overflow-hidden rounded-l-full bg-fondo">
            <div className="h-full rounded-l-full bg-teal transition-[width] duration-500 ease-out" style={{ width: `${pctActiva}%` }} />
          </div>
          <span className="w-[132px] shrink-0 text-center text-[11.5px] font-bold text-cuerpo">
            Población activa
          </span>
          <div className="h-6 flex-1 rounded-r-full bg-transparent" aria-hidden="true" />
        </div>
        <div className="flex items-center gap-3 text-[11px] text-gris">
          <span className="flex-1 text-right tabular-nums">{formatoPersonas(activa.num_personas)}</span>
          <span className="w-[132px] shrink-0" aria-hidden="true" />
          <span className="flex-1" aria-hidden="true" />
        </div>

        {/* Fila 2: Jubilados — barra espejada, crece hacia la DERECHA desde el eje central */}
        <div className="mt-3 flex items-center gap-3">
          <div className="h-6 flex-1 rounded-l-full bg-transparent" aria-hidden="true" />
          <span className="w-[132px] shrink-0 text-center text-[11.5px] font-bold text-cuerpo">Jubilados</span>
          <div className="flex h-6 flex-1 items-center overflow-hidden rounded-r-full bg-fondo">
            <div
              className="h-full rounded-r-full bg-magenta/70 transition-[width] duration-500 ease-out"
              style={{ width: `${pctJubilados}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-gris">
          <span className="flex-1" aria-hidden="true" />
          <span className="w-[132px] shrink-0" aria-hidden="true" />
          <span className="flex-1 tabular-nums">
            {formatoPersonas(jubilados.num_personas)}
            {jubilados.valor_medio_cents !== null && jubilados.unidad_valor_medio
              ? ` · pensión media ${(jubilados.valor_medio_cents / 100).toLocaleString('es-ES', { maximumFractionDigits: 0, useGrouping: 'always' })}${jubilados.unidad_valor_medio.startsWith('€') ? jubilados.unidad_valor_medio.slice(1) : ` ${jubilados.unidad_valor_medio}`}`
              : ''}
          </span>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-gris">
        Fuente: {activa.fuente?.trim() || 'PENDIENTE DE FUENTE'} · {jubilados.fuente?.trim() || 'PENDIENTE DE FUENTE'}
      </p>
    </div>
  );
}
