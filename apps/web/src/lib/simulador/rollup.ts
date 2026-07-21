/**
 * lib/simulador/rollup.ts
 *
 * Sumas jerárquicas sobre el árbol de `sim_partidas` (docs/tecnico/
 * simulador-pais.md §3). Módulo genérico y sin conocimiento de fórmulas:
 * recibe, para UN lado (actual o RC), el valor "propio" ya resuelto de
 * cada partida (o `null` si su fórmula falló — D-S8) y calcula:
 *
 *   - `sinDesglosarCents` = propio − Σhijos (para un nodo con hijos). Un
 *     hijo sin resolver contribuye 0 a la suma (nunca propaga NaN) pero se
 *     reporta aparte por el llamador (resolver.ts conoce el motivo).
 *   - `descuadre` = sinDesglosarCents < 0 (los hijos suman más que el
 *     total declarado del padre).
 *   - `balanceCents` = Σ ingresos raíz − Σ gastos raíz, usando el valor
 *     "propio" de cada raíz (que YA representa el total de esa área,
 *     hijos incluidos — ver ejemplo Defensa en §6 del doc de arquitectura).
 *     Una raíz sin resolver se EXCLUYE del balance (no contribuye 0 en
 *     silencio: queda listada en `raicesSinResolver`).
 */

import type { TipoPartida } from './tipos';

export interface NodoRollupInput {
  id: string;
  parentId: string | null;
  tipo: TipoPartida;
  /** Valor propio ya resuelto en céntimos, o `null` si la fórmula falló. */
  propioCents: number | null;
}

export interface NodoRollupResultado {
  id: string;
  propioCents: number | null;
  hijosCents: number;
  sinDesglosarCents: number | null;
  descuadre: boolean;
}

export interface ResultadoRollup {
  nodos: Map<string, NodoRollupResultado>;
  balanceCents: number;
  raicesSinResolver: string[];
}

export function calcularRollup(nodos: NodoRollupInput[]): ResultadoRollup {
  const porId = new Map<string, NodoRollupInput>();
  const hijosDe = new Map<string, string[]>();

  for (const nodo of nodos) {
    porId.set(nodo.id, nodo);
    if (!hijosDe.has(nodo.id)) hijosDe.set(nodo.id, []);
  }
  for (const nodo of nodos) {
    if (nodo.parentId !== null) {
      const lista = hijosDe.get(nodo.parentId);
      // Un parent_id que no exista en la lista (no debería pasar: FK en BD)
      // no rompe el cálculo — el nodo huérfano simplemente no participa en
      // el sin_desglosar de un padre inexistente.
      if (lista) lista.push(nodo.id);
      else hijosDe.set(nodo.parentId, [nodo.id]);
    }
  }

  const resultado = new Map<string, NodoRollupResultado>();

  for (const nodo of nodos) {
    const idsHijos = hijosDe.get(nodo.id) ?? [];
    let hijosCents = 0;
    for (const idHijo of idsHijos) {
      const hijo = porId.get(idHijo);
      if (hijo && hijo.propioCents !== null) {
        hijosCents += hijo.propioCents;
      }
      // Un hijo sin resolver (propioCents === null) contribuye 0 — nunca NaN.
    }

    const sinDesglosarCents = nodo.propioCents === null ? null : nodo.propioCents - hijosCents;
    const descuadre = sinDesglosarCents !== null && sinDesglosarCents < 0;

    resultado.set(nodo.id, {
      id: nodo.id,
      propioCents: nodo.propioCents,
      hijosCents,
      sinDesglosarCents,
      descuadre,
    });
  }

  let balanceCents = 0;
  const raicesSinResolver: string[] = [];
  for (const nodo of nodos) {
    if (nodo.parentId !== null) continue; // el balance solo suma raíces
    if (nodo.propioCents === null) {
      raicesSinResolver.push(nodo.id);
      continue;
    }
    balanceCents += nodo.tipo === 'ingreso' ? nodo.propioCents : -nodo.propioCents;
  }

  return { nodos: resultado, balanceCents, raicesSinResolver };
}
