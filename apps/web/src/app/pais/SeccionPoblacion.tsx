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
 * El donut de composición y el % de cada tarjeta SOLO se calculan si existe
 * una fila publicada cuyo nombre sea EXACTAMENTE "Población total de
 * España" — es el único denominador fiable para un porcentaje honesto
 * (D-S1: no fabricar datos). Sin esa fila ancla, se muestran las tarjetas
 * sin donut y sin porcentaje.
 */

import { cn } from '@/lib/cn';
import type { DemografiaRow } from '@/lib/simulador/adminData';
import { formatoEurosConUnidad, formatoPersonasCorto } from '@/lib/simulador/formato';
import { DonutChart } from './DonutChart';
import { PiramidePoblacional } from './PiramidePoblacional';

const NOMBRE_ANCLA = 'Población total de España';
const NOMBRE_ACTIVA = 'Población activa';
const NOMBRE_PARADOS = 'Parados';
// "¿Quién sostiene las pensiones?" (segunda revisión, Sergio): 4 categorías,
// no bandas de edad puras. "Estudiantes"/"Niños" SON las mismas filas que ya
// se muestran como tarjetas normales (se reutilizan sin más). "Pensionistas",
// "Personas con ayudas y dependientes" y "Cotizantes" son filas NUEVAS,
// exclusivas de este gráfico — EXCLUIDAS del donut de composición por
// categoría social/laboral (mismo motivo que "Población activa": una mirada
// DISTINTA de la población, mezclarlas contaría gente dos veces).
const NOMBRE_PENSIONISTAS = 'Pensionistas';
const NOMBRE_AYUDAS_DEPENDIENTES = 'Personas con ayudas y dependientes';
const NOMBRE_COTIZANTES = 'Cotizantes';
const NOMBRE_ESTUDIANTES = 'Estudiantes';
const NOMBRE_NINOS = 'Niños';
/** Parados fluctúa mes a mes (EPA/SEPE) — la cifra publicada es una MEDIA,
 * no un dato fijo. Se avisa en la propia tarjeta para no dar una falsa
 * sensación de precisión puntual (mismo principio de honestidad que el
 * "Calculado" de Otros, D-S1). */
const NOTA_PARADOS = 'Media aproximada — el dato real fluctúa mes a mes';

interface TarjetaDatos {
  id: string;
  nombre: string;
  numPersonas: number;
  valorMedioCents?: number | null;
  unidadValorMedio?: string | null;
  /** Texto pequeño bajo la cifra — para "Otros (resto)" explica que es un
   * cálculo, no un dato; para "Parados" avisa de que es una media que
   * fluctúa. Genérico para no tener que inventar un caso especial por cada
   * matiz nuevo que aparezca. */
  nota?: string;
  /** "Otros (resto)"/el propio ancla no son filas normales — el borde
   * discontinuo distingue un cálculo de un dato real. */
  calculada?: boolean;
  esAncla?: boolean;
}

function TarjetaPersona({ tarjeta, totalPoblacion }: { tarjeta: TarjetaDatos; totalPoblacion: number | null }) {
  const { nombre, numPersonas, valorMedioCents, unidadValorMedio, nota, calculada, esAncla } = tarjeta;
  // % trivial (100%) en la propia ancla — no aporta, se omite.
  const pct = !esAncla && totalPoblacion ? (numPersonas / totalPoblacion) * 100 : null;

  return (
    <div className={cn('rounded-boton border p-4', calculada ? 'border-dashed border-linea bg-fondo' : 'border-linea bg-white')}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13.5px] font-bold text-titular">{nombre}</p>
        {pct !== null && (
          <span className="shrink-0 rounded-full bg-teal/10 px-2 py-0.5 text-[10.5px] font-bold text-teal-texto tabular-nums">
            {pct.toLocaleString('es-ES', { maximumFractionDigits: 1, useGrouping: 'always' })}%
          </span>
        )}
      </div>
      <p className="mt-1 text-[19px] font-extrabold tabular-nums text-titular">{formatoPersonasCorto(numPersonas)}</p>
      {valorMedioCents !== null && valorMedioCents !== undefined && (
        <p className="mt-1 text-[12px] text-cuerpo">{formatoEurosConUnidad(valorMedioCents, unidadValorMedio)}</p>
      )}
      {nota && <p className="mt-1 text-[10.5px] text-gris">{nota}</p>}
    </div>
  );
}

export function SeccionPoblacion({ filas }: { filas: DemografiaRow[] }) {
  if (filas.length === 0) return null;

  const ancla = filas.find((f) => f.nombre.trim() === NOMBRE_ANCLA);
  const pensionistas = filas.find((f) => f.nombre.trim() === NOMBRE_PENSIONISTAS);
  const ayudasDependientes = filas.find((f) => f.nombre.trim() === NOMBRE_AYUDAS_DEPENDIENTES);
  const cotizantes = filas.find((f) => f.nombre.trim() === NOMBRE_COTIZANTES);
  const estudiantes = filas.find((f) => f.nombre.trim() === NOMBRE_ESTUDIANTES);
  const ninos = filas.find((f) => f.nombre.trim() === NOMBRE_NINOS);
  // "Población activa", "Pensionistas", "Personas con ayudas y dependientes"
  // y "Cotizantes" se EXCLUYEN del donut de composición por categoría
  // social/laboral (no de las tarjetas donde aplique — "Estudiantes"/"Niños"
  // siguen siendo tarjetas normales, ya lo eran): son una mirada DISTINTA de
  // la misma población — mezclarlas con Asalariados/Funcionarios/Autónomos/
  // Jubilados contaría gente dos veces y el "Resto" saldría mal.
  const otras = filas.filter(
    (f) =>
      f.id !== ancla?.id &&
      f.nombre.trim() !== NOMBRE_ACTIVA &&
      f.nombre.trim() !== NOMBRE_PENSIONISTAS &&
      f.nombre.trim() !== NOMBRE_AYUDAS_DEPENDIENTES &&
      f.nombre.trim() !== NOMBRE_COTIZANTES,
  );

  // Segmentos del donut relativos al ANCLA (única forma de un % honesto,
  // ver comentario de arriba) — se añade un "Resto" para que el donut sume
  // el total real de la fila ancla, no la suma (potencialmente solapada, p.
  // ej. niños/estudiantes) de las categorías conocidas.
  let segmentosDonut: { nombre: string; valor: number; color: string | null }[] = [];
  let resto = 0;
  if (ancla) {
    const sumaOtras = otras.reduce((suma, o) => suma + o.num_personas, 0);
    resto = ancla.num_personas - sumaOtras;
    segmentosDonut = [
      ...otras.map((o) => ({ nombre: o.nombre, valor: o.num_personas, color: null })),
      ...(resto > 0 ? [{ nombre: 'Resto de la población', valor: resto, color: '#6F6F6F' }] : []),
    ];
  }

  // Tarjetas a mostrar: todas las filas reales + "Otros (resto)" calculado
  // (mismo criterio que el donut) — unidas ANTES de ordenar, para que el
  // "de mayor a menor" (Sergio) incluya también a Otros en su sitio real,
  // no siempre al final.
  const tarjetas: TarjetaDatos[] = [
    ...filas
      .filter(
        (f) =>
          f.nombre.trim() !== NOMBRE_PENSIONISTAS &&
          f.nombre.trim() !== NOMBRE_AYUDAS_DEPENDIENTES &&
          f.nombre.trim() !== NOMBRE_COTIZANTES,
      )
      .map((f) => ({
        id: f.id,
        nombre: f.nombre,
        numPersonas: f.num_personas,
        valorMedioCents: f.valor_medio_cents,
        unidadValorMedio: f.unidad_valor_medio,
        esAncla: f.id === ancla?.id,
        nota: f.nombre.trim() === NOMBRE_PARADOS ? NOTA_PARADOS : undefined,
      })),
    ...(ancla && resto > 0
      ? [
          {
            id: '__otros__',
            nombre: 'Otros (resto)',
            numPersonas: resto,
            calculada: true,
            nota: 'Calculado: total − categorías conocidas',
          },
        ]
      : []),
  ].sort((a, b) => b.numPersonas - a.numPersonas);

  return (
    <section className="mx-auto mt-8 max-w-[1080px] rounded-tarjeta border border-linea bg-white p-5 min-[720px]:p-6">
      <h2 className="text-[15px] font-extrabold uppercase tracking-wide text-titular">Población de España</h2>
      <p className="mt-1 text-[12.5px] text-cuerpo">
        Segmentos de población publicados por el equipo, de mayor a menor — dato informativo, sin lado Razón Común.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 min-[560px]:grid-cols-3 min-[900px]:grid-cols-4">
        {tarjetas.map((t) => (
          <TarjetaPersona key={t.id} tarjeta={t} totalPoblacion={ancla?.num_personas ?? null} />
        ))}
      </div>

      {/* Composición (donut) y pirámide (activos/jubilados) lado a lado —
          50/50 en escritorio, apiladas en móvil (Sergio). Cada bloque se
          renderiza solo si tiene datos; si falta uno, el otro ocupa toda la
          fila (grid-cols-1 en ese caso concreto lo resolvería un contenedor
          por bloque en vez de dos columnas fijas siempre). */}
      {((ancla && segmentosDonut.length > 0) || (pensionistas && ayudasDependientes && cotizantes && estudiantes && ninos)) && (
        <div className="mt-5 grid grid-cols-1 gap-6 border-t border-linea pt-4 min-[720px]:grid-cols-2">
          {ancla && segmentosDonut.length > 0 && (
            <div>
              <p className="mb-2 text-[11.5px] font-bold uppercase tracking-wide text-gris">
                Composición sobre {formatoPersonasCorto(ancla.num_personas)}
              </p>
              <DonutChart segmentos={segmentosDonut} titulo="Población" />
            </div>
          )}
          <PiramidePoblacional
            pensionistas={pensionistas}
            ayudasDependientes={ayudasDependientes}
            cotizantes={cotizantes}
            estudiantes={estudiantes}
            ninos={ninos}
            sinBorde
          />
        </div>
      )}
    </section>
  );
}
