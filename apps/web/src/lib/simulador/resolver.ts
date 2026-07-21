/**
 * lib/simulador/resolver.ts
 *
 * Resuelve el modelo entero del país (docs/tecnico/simulador-pais.md §3,
 * D-S7). Orden de resolución determinista:
 *
 *   1. Parámetros base (modo='fijo').
 *   2. Parámetros derivados (modo='formula', D-S2b — elasticidades), en
 *      orden topológico, con detección de ciclos (DFS).
 *   3. Valores "propios" de las partidas, lado actual.
 *   4. Valores "propios" de las partidas, lado Razón Común.
 *   5. Rollups (rollup.ts) y balance, por separado para actual y RC.
 *
 * Los pasos 1-2 se hacen DOS VECES, una por cada "mapa de valores": el
 * evaluador SIEMPRE recibe el mapa completo ya elegido (D-S8) — el lado
 * actual usa `valor_actual`; el lado RC usa `valor_rc ?? valor_actual`. Un
 * mismo parámetro derivado (p. ej. `num_autonomos`, que depende de
 * `cuota_media_autonomo`) puede así producir un valor distinto en cada
 * mapa sin duplicar código: se resuelve una vez por mapa.
 *
 * Overrides (D-S7/D-S9 — palancas movidas, sandbox público y edición en
 * vivo del admin): por diseño, SOLO desplazan el lado ACTUAL/base:
 *   - `overrides.parametros[clave]` reemplaza el valor base de un
 *     parámetro fijo. El mapa RC de ese parámetro sigue usando su
 *     `valor_rc` explícito si lo tiene (la propuesta de RC no se mueve
 *     sola porque alguien toquetee el dato "actual"); si el parámetro NO
 *     tiene `valor_rc` (hereda el actual), el override SÍ se cuela en el
 *     mapa RC — es coherente con "RC hereda el actual cuando no dice lo
 *     contrario".
 *   - `overrides.partidas[id]` reemplaza el valor propio ya resuelto del
 *     lado actual de una partida (en céntimos), sea cual sea su
 *     `actual_modo`. El lado RC de esa partida sigue derivándose con
 *     normalidad de ese valor actual (ya con el override aplicado) cuando
 *     su `rc_modo` es `fijo` sin `rc_cents` o `pct_actual` — así es como
 *     el editor de admin ve el balance recalcularse en vivo al cambiar una
 *     cifra "actual" que alimenta un `-20%` de RC.
 * Es una decisión de diseño documentada aquí para quien construya el
 * sandbox público (S2): si la interacción deseada allí es distinta, este
 * es el punto a revisar — el resto del motor no cambia.
 */

import { evaluar, extraerIdentificadores } from './evaluador';
import { calcularRollup } from './rollup';
import type {
  ModeloResuelto,
  Overrides,
  ParametroInput,
  ParametroResueltoInfo,
  PartidaInput,
  PartidaResueltaInfo,
  SinResolverEntry,
} from './tipos';

type Lado = 'actual' | 'rc';

interface ResultadoMapaParametros {
  valores: Map<string, number>;
  errores: Map<string, string>;
}

/**
 * Resuelve TODOS los parámetros para un lado dado (actual o rc), incluidos
 * los derivados en cadena, con detección de ciclos vía DFS. Nunca entra en
 * bucle infinito: un ciclo se detecta por la pila de "en curso" y se
 * reporta con la cadena completa (`a→b→a`).
 */
function resolverMapaParametros(
  parametros: ParametroInput[],
  lado: Lado,
  overrides: Record<string, number> | undefined,
): ResultadoMapaParametros {
  const porClave = new Map(parametros.map((p) => [p.clave, p]));
  const valores = new Map<string, number>();
  const errores = new Map<string, string>();
  const enCurso = new Set<string>();

  function valorBaseActual(p: ParametroInput): number {
    // El override SOLO se aplica al valor base "actual" (fijo).
    const ov = overrides?.[p.clave];
    return ov !== undefined ? ov : (p.valor_actual as number);
  }

  function resolverClave(clave: string, cadena: string[]): void {
    if (valores.has(clave) || errores.has(clave)) return;

    const p = porClave.get(clave);
    if (!p) {
      errores.set(clave, `parámetro desconocido: ${clave}`);
      return;
    }

    if (p.modo === 'fijo') {
      const base = valorBaseActual(p);
      if (lado === 'actual') {
        valores.set(clave, base);
      } else {
        // RC hereda el "actual" (con override incluido) si no tiene su
        // propio valor_rc explícito.
        valores.set(clave, p.valor_rc ?? base);
      }
      return;
    }

    // modo === 'formula' (derivado — D-S2b). Un derivado nunca es palanca,
    // así que no se le aplica override directamente; su valor sale siempre
    // de evaluar su fórmula contra las dependencias ya resueltas.
    if (enCurso.has(clave)) {
      const cadenaTexto = [...cadena, clave].join('→');
      errores.set(clave, `ciclo de dependencias entre parámetros: ${cadenaTexto}`);
      return;
    }

    if (!p.formula) {
      errores.set(clave, `parámetro derivado "${clave}" sin fórmula`);
      return;
    }

    const ids = extraerIdentificadores(p.formula);
    if (!ids.ok) {
      errores.set(clave, ids.error);
      return;
    }

    enCurso.add(clave);
    for (const dep of ids.identificadores) {
      resolverClave(dep, [...cadena, clave]);
    }
    enCurso.delete(clave);

    // Si alguna dependencia quedó sin resolver, este derivado también falla.
    // OJO: si `clave` YA tiene un error propio (p. ej. el DFS lo marcó como
    // parte de un ciclo mientras esta misma llamada seguía "en curso" más
    // abajo en la pila — ver el caso a→b→a), NO lo sobrescribimos aquí con
    // un mensaje genérico: perderíamos la cadena exacta del ciclo.
    const depFallida = ids.identificadores.find((dep) => errores.has(dep));
    if (depFallida) {
      if (!errores.has(clave)) {
        errores.set(clave, `depende de "${depFallida}", que no se pudo resolver`);
      }
      return;
    }

    const valoresParciales: Record<string, number> = {};
    for (const dep of ids.identificadores) {
      valoresParciales[dep] = valores.get(dep) as number;
    }

    const resultado = evaluar(p.formula, valoresParciales);
    if (!resultado.ok) {
      errores.set(clave, resultado.error);
      return;
    }
    valores.set(clave, resultado.valor);
  }

  for (const p of parametros) {
    resolverClave(p.clave, []);
  }

  return { valores, errores };
}

function resolverParametros(
  parametros: ParametroInput[],
  overrides?: Overrides,
): { info: ParametroResueltoInfo[]; mapaActual: Map<string, number>; mapaRC: Map<string, number> } {
  const actual = resolverMapaParametros(parametros, 'actual', overrides?.parametros);
  const rc = resolverMapaParametros(parametros, 'rc', overrides?.parametros);

  const info: ParametroResueltoInfo[] = parametros.map((p) => ({
    clave: p.clave,
    nombre: p.nombre,
    unidad: p.unidad,
    modo: p.modo,
    esPalanca: p.es_palanca,
    palancaMin: p.palanca_min,
    palancaMax: p.palanca_max,
    valorActual: actual.valores.get(p.clave) ?? null,
    valorRC: rc.valores.get(p.clave) ?? null,
    errorActual: actual.errores.get(p.clave),
    errorRC: rc.errores.get(p.clave),
  }));

  return { info, mapaActual: actual.valores, mapaRC: rc.valores };
}

function resolverPropioPartidaActual(
  partida: PartidaInput,
  mapaActual: Map<string, number>,
  overridePartidas: Record<string, number> | undefined,
): { cents: number | null; error?: string } {
  const override = overridePartidas?.[partida.id];
  if (override !== undefined) {
    return { cents: override };
  }

  if (partida.actual_modo === 'fijo') {
    return { cents: partida.actual_cents };
  }

  // formula: opera en EUROS (D-S4), se materializa ×100 al final.
  if (!partida.actual_formula) {
    return { cents: null, error: 'partida en modo fórmula sin fórmula definida' };
  }
  const valores = Object.fromEntries(mapaActual);
  const resultado = evaluar(partida.actual_formula, valores);
  if (!resultado.ok) {
    return { cents: null, error: resultado.error };
  }
  return { cents: Math.round(resultado.valor * 100) };
}

function resolverPropioPartidaRC(
  partida: PartidaInput,
  actualCents: number | null,
  mapaRC: Map<string, number>,
): { cents: number | null; error?: string } {
  if (partida.rc_modo === 'fijo') {
    // 'fijo' sin rc_cents => hereda el actual (comentario del esquema).
    if (partida.rc_cents !== null && partida.rc_cents !== undefined) {
      return { cents: partida.rc_cents };
    }
    if (actualCents === null) {
      return { cents: null, error: 'hereda el valor actual, que no se pudo resolver' };
    }
    return { cents: actualCents };
  }

  if (partida.rc_modo === 'pct_actual') {
    if (partida.rc_pct === null || partida.rc_pct === undefined) {
      return { cents: null, error: 'modo pct_actual sin rc_pct definido' };
    }
    if (actualCents === null) {
      return { cents: null, error: 'depende del valor actual, que no se pudo resolver' };
    }
    return { cents: Math.round(actualCents * (1 + partida.rc_pct / 100)) };
  }

  // formula (D-S2: solo referencia parámetros, en euros → ×100 al final).
  if (!partida.rc_formula) {
    return { cents: null, error: 'partida RC en modo fórmula sin fórmula definida' };
  }
  const valores = Object.fromEntries(mapaRC);
  const resultado = evaluar(partida.rc_formula, valores);
  if (!resultado.ok) {
    return { cents: null, error: resultado.error };
  }
  return { cents: Math.round(resultado.valor * 100) };
}

/**
 * Resuelve el modelo completo. Función pura y determinista: mismos
 * argumentos, mismo resultado. No consulta la BD (D-S8) — recibe los datos
 * ya cargados.
 */
export function resolver(
  parametros: ParametroInput[],
  partidas: PartidaInput[],
  overrides?: Overrides,
): ModeloResuelto {
  const { info: parametrosInfo, mapaActual, mapaRC } = resolverParametros(parametros, overrides);

  const propiosActual = new Map<string, { cents: number | null; error?: string }>();
  const propiosRC = new Map<string, { cents: number | null; error?: string }>();

  for (const partida of partidas) {
    propiosActual.set(partida.id, resolverPropioPartidaActual(partida, mapaActual, overrides?.partidas));
  }
  for (const partida of partidas) {
    const actual = propiosActual.get(partida.id)!;
    propiosRC.set(partida.id, resolverPropioPartidaRC(partida, actual.cents, mapaRC));
  }

  const rollupActual = calcularRollup(
    partidas.map((p) => ({
      id: p.id,
      parentId: p.parent_id,
      tipo: p.tipo,
      propioCents: propiosActual.get(p.id)!.cents,
    })),
  );
  const rollupRC = calcularRollup(
    partidas.map((p) => ({
      id: p.id,
      parentId: p.parent_id,
      tipo: p.tipo,
      propioCents: propiosRC.get(p.id)!.cents,
    })),
  );

  const partidasInfo: PartidaResueltaInfo[] = partidas.map((p) => {
    const actual = propiosActual.get(p.id)!;
    const rc = propiosRC.get(p.id)!;
    const rActual = rollupActual.nodos.get(p.id)!;
    const rRC = rollupRC.nodos.get(p.id)!;

    return {
      id: p.id,
      parentId: p.parent_id,
      tipo: p.tipo,
      nombre: p.nombre,
      ambito: p.ambito,
      ministryId: p.ministry_id ?? null,
      color: p.color ?? null,
      esPalanca: p.es_palanca,
      palancaMinCents: p.palanca_min,
      palancaMaxCents: p.palanca_max,
      actual: {
        propioCents: actual.cents,
        hijosCents: rActual.hijosCents,
        sinDesglosarCents: rActual.sinDesglosarCents,
        descuadre: rActual.descuadre,
        error: actual.error,
      },
      rc: {
        propioCents: rc.cents,
        hijosCents: rRC.hijosCents,
        sinDesglosarCents: rRC.sinDesglosarCents,
        descuadre: rRC.descuadre,
        error: rc.error,
      },
    };
  });

  const sinResolver: SinResolverEntry[] = [];
  for (const p of parametrosInfo) {
    if (p.errorActual) sinResolver.push({ tipo: 'parametro', id: p.clave, nombre: p.nombre, lado: 'actual', error: p.errorActual });
    if (p.errorRC) sinResolver.push({ tipo: 'parametro', id: p.clave, nombre: p.nombre, lado: 'rc', error: p.errorRC });
  }
  for (const p of partidasInfo) {
    if (p.actual.error) sinResolver.push({ tipo: 'partida', id: p.id, nombre: p.nombre, lado: 'actual', error: p.actual.error });
    if (p.rc.error) sinResolver.push({ tipo: 'partida', id: p.id, nombre: p.nombre, lado: 'rc', error: p.rc.error });
  }

  const raicesIngresos = partidas.filter((p) => p.parent_id === null && p.tipo === 'ingreso').map((p) => p.id);
  const raicesGastos = partidas.filter((p) => p.parent_id === null && p.tipo === 'gasto').map((p) => p.id);

  return {
    parametros: parametrosInfo,
    partidas: partidasInfo,
    balance: {
      actualCents: rollupActual.balanceCents,
      rcCents: rollupRC.balanceCents,
    },
    raices: {
      ingresos: raicesIngresos,
      gastos: raicesGastos,
    },
    sinResolver,
  };
}
