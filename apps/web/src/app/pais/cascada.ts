/**
 * app/pais/cascada.ts
 *
 * "El efecto videojuego" (docs/tecnico/simulador-pais.md §5, S2): al mover
 * una palanca, enseñar TODO lo que se recalcula, no solo el número final.
 *
 * Enfoque: en vez de reconstruir el grafo de fórmulas a mano y razonar en
 * abstracto sobre signos, se DIFF-ea el `ModeloResuelto` de antes y de
 * después de mover la palanca (ambos ya calculados por `resolver()` — D-S7,
 * cero lógica duplicada). Es más simple Y más correcto: el resolver es la
 * única fuente de verdad, así que comparar sus dos salidas nunca puede dar
 * una dirección de cambio equivocada, cosa que sí podría pasar razonando
 * "a mano" sobre una fórmula con paréntesis y elasticidades encadenadas.
 *
 * También es honesto sobre los casos donde el efecto NO llega al balance:
 * una raíz con cifra oficial fija (D-S1/rollup.ts) no se mueve aunque uno
 * de sus hijos sí lo haga — el motor ya distingue "propio" de "sin
 * desglosar", y aquí simplemente se refleja esa verdad en el texto en vez
 * de inventar un "→ balance" que no ha ocurrido (ver riesgo 1b del doc de
 * arquitectura: las elasticidades son hipótesis, no se dora la píldora).
 */

import type { ModeloResuelto } from '@/lib/simulador/tipos';

export type OrigenPalanca =
  | { tipo: 'parametro'; clave: string; nombre: string }
  | { tipo: 'partida'; id: string; nombre: string };

interface CambioNumerico {
  antes: number | null;
  despues: number | null;
}

export interface CambioParametroCascada {
  clave: string;
  nombre: string;
  derivado: boolean;
  cambio: CambioNumerico;
}

export interface CambioPartidaCascada {
  id: string;
  nombre: string;
  lado: 'actual' | 'rc';
  cambio: CambioNumerico;
}

export interface DesgloseCascada {
  id: string;
  nombre: string;
}

export interface ResultadoCascada {
  origen: OrigenPalanca;
  parametros: CambioParametroCascada[];
  partidasPropio: CambioPartidaCascada[];
  partidasDesglose: DesgloseCascada[];
  balanceActual: CambioNumerico | null;
  balanceRC: CambioNumerico | null;
  /** ids de `sim_partidas` que deben "pulsar" en el panel (propio o desglose tocados). */
  idsPulso: Set<string>;
  /** claves de `sim_parametros` que deben "pulsar" (incluida la palanca movida). */
  clavesPulso: Set<string>;
  cadenaTexto: string;
  huboCambio: boolean;
}

const EPS = 1e-6;

function distinto(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return a !== b;
  return Math.abs(a - b) > EPS;
}

function signo(despues: number | null, antes: number | null): 1 | -1 | 0 {
  if (despues === null || antes === null) return 0;
  if (despues > antes + EPS) return 1;
  if (despues < antes - EPS) return -1;
  return 0;
}

function flecha(dir: 1 | -1 | 0): string {
  return dir > 0 ? '↑' : dir < 0 ? '↓' : '≈';
}

/**
 * Compara el modelo resuelto ANTES y DESPUÉS de mover una palanca (mismo
 * `resolver()` que pinta el panel — D-S7) y construye la cadena visible.
 * Función pura: no toca el DOM, no conoce React.
 */
export function detectarCascada(
  origen: OrigenPalanca,
  anterior: ModeloResuelto,
  nuevo: ModeloResuelto,
): ResultadoCascada {
  const parametros: CambioParametroCascada[] = [];
  const clavesPulso = new Set<string>();

  const paramAnteriorPorClave = new Map(anterior.parametros.map((p) => [p.clave, p]));
  for (const p of nuevo.parametros) {
    const prev = paramAnteriorPorClave.get(p.clave);
    if (!prev) continue;
    const tocaActual = distinto(prev.valorActual, p.valorActual);
    const tocaRC = distinto(prev.valorRC, p.valorRC);
    if (!tocaActual && !tocaRC) continue;
    // El sandbox pilota siempre el lado "actual" (D-S7); si por herencia
    // también cambia el RC, se sigue mostrando el lado actual como referencia
    // — salvo que el actual no se haya movido y el único cambio sea el RC
    // heredado (caso raro pero posible).
    const cambio = tocaActual ? { antes: prev.valorActual, despues: p.valorActual } : { antes: prev.valorRC, despues: p.valorRC };
    parametros.push({ clave: p.clave, nombre: p.nombre, derivado: p.modo === 'formula', cambio });
    clavesPulso.add(p.clave);
  }

  const partidasPropio: CambioPartidaCascada[] = [];
  const partidasDesglose: DesgloseCascada[] = [];
  const idsPulso = new Set<string>();
  const nombresDesglose = new Set<string>();

  const partidaAnteriorPorId = new Map(anterior.partidas.map((p) => [p.id, p]));
  for (const p of nuevo.partidas) {
    const prev = partidaAnteriorPorId.get(p.id);
    if (!prev) continue;
    let tocada = false;

    if (distinto(prev.actual.propioCents, p.actual.propioCents)) {
      partidasPropio.push({ id: p.id, nombre: p.nombre, lado: 'actual', cambio: { antes: prev.actual.propioCents, despues: p.actual.propioCents } });
      tocada = true;
    } else if (distinto(prev.actual.sinDesglosarCents, p.actual.sinDesglosarCents)) {
      nombresDesglose.add(p.nombre);
      tocada = true;
    }

    if (distinto(prev.rc.propioCents, p.rc.propioCents)) {
      partidasPropio.push({ id: p.id, nombre: p.nombre, lado: 'rc', cambio: { antes: prev.rc.propioCents, despues: p.rc.propioCents } });
      tocada = true;
    } else if (distinto(prev.rc.sinDesglosarCents, p.rc.sinDesglosarCents)) {
      nombresDesglose.add(p.nombre);
      tocada = true;
    }

    if (tocada) idsPulso.add(p.id);
  }
  for (const nombre of nombresDesglose) partidasDesglose.push({ id: nombre, nombre });

  const balanceActual = distinto(anterior.balance.actualCents, nuevo.balance.actualCents)
    ? { antes: anterior.balance.actualCents, despues: nuevo.balance.actualCents }
    : null;
  const balanceRC = distinto(anterior.balance.rcCents, nuevo.balance.rcCents)
    ? { antes: anterior.balance.rcCents, despues: nuevo.balance.rcCents }
    : null;

  const huboCambio =
    parametros.length > 0 || partidasPropio.length > 0 || partidasDesglose.length > 0 || balanceActual !== null || balanceRC !== null;

  const direccionOrigen = (() => {
    if (origen.tipo === 'parametro') {
      const c = parametros.find((p) => p.clave === origen.clave);
      return c ? signo(c.cambio.despues, c.cambio.antes) : 0;
    }
    const c = partidasPropio.find((p) => p.id === origen.id);
    return c ? signo(c.cambio.despues, c.cambio.antes) : 0;
  })();

  const partes: string[] = [`${origen.nombre} ${flecha(direccionOrigen)}`];

  for (const p of parametros) {
    if (origen.tipo === 'parametro' && p.clave === origen.clave) continue;
    partes.push(`${p.nombre} ${flecha(signo(p.cambio.despues, p.cambio.antes))}${p.derivado ? ' (elasticidad)' : ''}`);
  }

  const partidasVistas = new Set<string>();
  for (const c of partidasPropio) {
    if (origen.tipo === 'partida' && c.id === origen.id && c.lado === 'actual') continue;
    const clave = `${c.id}-${c.lado}`;
    if (partidasVistas.has(clave)) continue;
    partidasVistas.add(clave);
    partes.push(`${c.nombre}${c.lado === 'rc' ? ' (lado RC)' : ''} ${flecha(signo(c.cambio.despues, c.cambio.antes))}`);
  }

  if (partidasPropio.length === 0 && partidasDesglose.length > 0) {
    partes.push(`desglose de ${[...nombresDesglose].join(', ')} se recalcula`);
  }

  if (balanceActual || balanceRC) {
    partes.push('balance');
  } else if (huboCambio) {
    partes.push('el balance no se mueve (el total oficial de esta área ya está fijado aparte)');
  }

  return {
    origen,
    parametros,
    partidasPropio,
    partidasDesglose,
    balanceActual,
    balanceRC,
    idsPulso,
    clavesPulso,
    cadenaTexto: huboCambio ? partes.join(' → ') : '',
    huboCambio,
  };
}
