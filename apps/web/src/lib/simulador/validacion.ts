/**
 * lib/simulador/validacion.ts
 *
 * Ayudas de validación para el admin (`adminActions.ts`), construidas
 * encima del motor sin duplicar su lógica:
 *
 *   - `validarFormula`: parseo + evaluación en seco contra los parámetros
 *     ya existentes (lado actual). Se usa tanto para fórmulas de partidas
 *     como para el "dry run" de un parámetro derivado nuevo/editado.
 *   - `validarFormulaParametroDerivado`: además de parsear/evaluar, detecta
 *     ciclos reutilizando el propio `resolver()` — construir el conjunto
 *     de parámetros con el candidato incluido y mirar si el resolver le
 *     asigna un error de "ciclo de dependencias" (mismo DFS que usa en
 *     producción, cero lógica duplicada).
 *   - `dondeSeUsaParametro`: localiza qué fórmulas (de otros parámetros o
 *     de partidas) referencian una clave — para bloquear el borrado con la
 *     lista de sitios donde se usa (§5 del doc de arquitectura).
 */

import { evaluar, extraerIdentificadores } from './evaluador';
import { resolver } from './resolver';
import type { ParametroInput, PartidaInput } from './tipos';

export type ResultadoValidacion = { ok: true } | { ok: false; error: string };

/**
 * Valida una fórmula de PARTIDA (D-S2: solo referencia parámetros) contra
 * los valores actuales ya resueltos de `parametros`. Parsea y evalúa en
 * seco; no persiste nada.
 */
export function validarFormulaPartida(formula: string, parametros: ParametroInput[]): ResultadoValidacion {
  const { parametros: info } = resolver(parametros, []);
  const valores: Record<string, number> = {};
  for (const p of info) {
    if (p.valorActual !== null) valores[p.clave] = p.valorActual;
  }
  const resultado = evaluar(formula, valores);
  return resultado.ok ? { ok: true } : { ok: false, error: resultado.error };
}

/**
 * Valida la fórmula de un parámetro DERIVADO (D-S2b) que se va a crear o
 * editar con clave `clave` y fórmula `formula`, contra el resto de
 * parámetros ya existentes (`existentes` — sin incluir la versión antigua
 * de este mismo si es una edición). Detecta ciclos reutilizando el DFS
 * real del resolver: si `formula` participa en un ciclo, `resolver()` le
 * asignará un `errorActual` con la cadena (`a→b→a`) — se devuelve tal cual.
 */
export function validarFormulaParametroDerivado(
  clave: string,
  formula: string,
  existentes: ParametroInput[],
): ResultadoValidacion {
  const sinSiMismo = existentes.filter((p) => p.clave !== clave);
  const candidato: ParametroInput = {
    clave,
    nombre: clave,
    unidad: null,
    modo: 'formula',
    formula,
    valor_actual: null,
    valor_rc: null,
    es_palanca: false,
    palanca_min: null,
    palanca_max: null,
  };

  const { parametros: info } = resolver([...sinSiMismo, candidato], []);
  const propio = info.find((p) => p.clave === clave);
  if (!propio?.errorActual) {
    return { ok: true };
  }

  // El DFS del resolver reparte los mensajes de error entre TODOS los nodos
  // del ciclo, pero solo uno de ellos lleva la cadena completa (`a→b→a`) —
  // cuál exactamente depende del orden de recorrido, no necesariamente el
  // propio candidato. Para no enseñarle al admin un "depende de X" sin
  // contexto, buscamos primero si algún parámetro del lote quedó marcado
  // con el mensaje de ciclo (chain completa) y esa es la razón real que
  // se muestra; si no hay ninguno (fallo distinto: sintaxis, parámetro
  // desconocido…), se usa el propio error del candidato.
  const conCadena = info.find((p) => p.errorActual?.includes('ciclo de dependencias'));
  return { ok: false, error: conCadena?.errorActual ?? propio.errorActual };
}

/**
 * Regla de publicación (D-S5, §5): "el botón Publicar exige `fuente_actual`
 * rellenada en el lado actual". Función pura y unitariamente testeable a
 * propósito — `adminActions.ts` la usa tanto para partidas como para
 * parámetros en vez de repetir el `if` inline en cada server action.
 */
export function puedePublicar(fuenteActual: string | null | undefined): ResultadoValidacion {
  if (!fuenteActual || !fuenteActual.trim()) {
    return { ok: false, error: 'No se puede publicar sin rellenar la fuente del valor actual.' };
  }
  return { ok: true };
}

export interface ReferenciaParametro {
  tipo: 'parametro' | 'partida_actual' | 'partida_rc';
  id: string;
  nombre: string;
}

/** ¿Qué fórmulas (de parámetros derivados o de partidas) referencian `clave`? */
export function dondeSeUsaParametro(
  clave: string,
  parametros: ParametroInput[],
  partidas: PartidaInput[],
): ReferenciaParametro[] {
  const referencias: ReferenciaParametro[] = [];

  for (const p of parametros) {
    if (p.modo !== 'formula' || !p.formula || p.clave === clave) continue;
    const ids = extraerIdentificadores(p.formula);
    if (ids.ok && ids.identificadores.includes(clave)) {
      referencias.push({ tipo: 'parametro', id: p.clave, nombre: p.nombre });
    }
  }

  for (const partida of partidas) {
    if (partida.actual_modo === 'formula' && partida.actual_formula) {
      const ids = extraerIdentificadores(partida.actual_formula);
      if (ids.ok && ids.identificadores.includes(clave)) {
        referencias.push({ tipo: 'partida_actual', id: partida.id, nombre: partida.nombre });
      }
    }
    if (partida.rc_modo === 'formula' && partida.rc_formula) {
      const ids = extraerIdentificadores(partida.rc_formula);
      if (ids.ok && ids.identificadores.includes(clave)) {
        referencias.push({ tipo: 'partida_rc', id: partida.id, nombre: partida.nombre });
      }
    }
  }

  return referencias;
}
