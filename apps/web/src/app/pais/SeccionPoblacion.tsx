/**
 * app/pais/SeccionPoblacion.tsx
 *
 * "Población de España" (D-S12/D-S11, docs/tecnico/simulador-pais.md §9):
 * sección en `/pais` justo tras la Cabecera, con los segmentos de
 * `sim_demografia` de `area_id is null` (jubilados, funcionarios,
 * estudiantes, autónomos, niños…). Puramente presentacional — sin estado,
 * sin interactividad — así que no necesita 'use client' aunque se monte
 * dentro de `PanelPais` (un componente cliente).
 *
 * D-S13: sin lado Razón Común aquí, es informativo.
 *
 * El donut de composición SOLO se calcula si existe una fila publicada
 * cuyo nombre sea EXACTAMENTE "Población total de España" — es el único
 * denominador fiable para un porcentaje honesto (D-S1: no fabricar datos).
 * Sin esa fila ancla, se muestran las tarjetas sin donut.
 */

import type { DemografiaRow } from '@/lib/simulador/adminData';
import { formatoEurosConUnidad, formatoPersonas } from '@/lib/simulador/formato';
import { DonutChart } from './DonutChart';
import { PiramidePoblacional } from './PiramidePoblacional';

const NOMBRE_ANCLA = 'Población total de España';
const NOMBRE_ACTIVA = 'Población activa';
const NOMBRE_JUBILADOS = 'Jubilados';

function TarjetaPersona({ fila }: { fila: DemografiaRow }) {
  return (
    <div className="rounded-boton border border-linea bg-white p-4">
      <p className="text-[13.5px] font-bold text-titular">{fila.nombre}</p>
      <p className="mt-1 text-[15px] font-extrabold tabular-nums text-titular">{formatoPersonas(fila.num_personas)}</p>
      {fila.valor_medio_cents !== null && (
        <p className="mt-1 text-[12px] text-cuerpo">{formatoEurosConUnidad(fila.valor_medio_cents, fila.unidad_valor_medio)}</p>
      )}
    </div>
  );
}

export function SeccionPoblacion({ filas }: { filas: DemografiaRow[] }) {
  if (filas.length === 0) return null;

  const ancla = filas.find((f) => f.nombre.trim() === NOMBRE_ANCLA);
  const activa = filas.find((f) => f.nombre.trim() === NOMBRE_ACTIVA);
  const jubilados = filas.find((f) => f.nombre.trim() === NOMBRE_JUBILADOS);
  // "Población activa" se EXCLUYE del donut de composición (no de las
  // tarjetas): es un agregado que SOLAPA con otras categorías ya listadas
  // (Funcionarios, Autónomos son subconjuntos de la población activa) — si
  // entrara como porción independiente, contaría a esas personas dos veces
  // y el "Resto" saldría mal. Su sitio es la pirámide (activos vs jubilados),
  // no una porción del pastel de composición.
  const otras = filas.filter((f) => f.id !== ancla?.id && f.nombre.trim() !== NOMBRE_ACTIVA);

  // Segmentos del donut relativos al ANCLA (única forma de un % honesto,
  // ver comentario de arriba) — se añade un "Resto" para que el donut sume
  // el total real de la fila ancla, no la suma (potencialmente solapada, p.
  // ej. niños/estudiantes) de las categorías conocidas.
  let segmentosDonut: { nombre: string; valor: number; color: string | null }[] = [];
  if (ancla) {
    const sumaOtras = otras.reduce((suma, o) => suma + o.num_personas, 0);
    const resto = ancla.num_personas - sumaOtras;
    segmentosDonut = [
      ...otras.map((o) => ({ nombre: o.nombre, valor: o.num_personas, color: null })),
      ...(resto > 0 ? [{ nombre: 'Resto de la población', valor: resto, color: '#6F6F6F' }] : []),
    ];
  }

  return (
    <section className="mx-auto mt-8 max-w-[1080px] rounded-tarjeta border border-linea bg-white p-5 min-[720px]:p-6">
      <h2 className="text-[15px] font-extrabold uppercase tracking-wide text-titular">Población de España</h2>
      <p className="mt-1 text-[12.5px] text-cuerpo">
        Segmentos de población publicados por el equipo — dato informativo, sin lado Razón Común.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 min-[520px]:grid-cols-2 min-[900px]:grid-cols-3">
        {filas.map((f) => (
          <TarjetaPersona key={f.id} fila={f} />
        ))}
      </div>

      {ancla && segmentosDonut.length > 0 && (
        <div className="mt-5 border-t border-linea pt-4">
          <p className="mb-2 text-[11.5px] font-bold uppercase tracking-wide text-gris">
            Composición sobre {formatoPersonas(ancla.num_personas)}
          </p>
          <DonutChart segmentos={segmentosDonut} titulo="Población" />
        </div>
      )}

      <PiramidePoblacional activa={activa} jubilados={jubilados} />
    </section>
  );
}
