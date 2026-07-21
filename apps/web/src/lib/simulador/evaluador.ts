/**
 * lib/simulador/evaluador.ts
 *
 * Mini-parser propio de fórmulas (D-S8, docs/tecnico/simulador-pais.md §4).
 * NUNCA usa `eval`/`Function`/`new Function`/`vm`: es un tokenizador +
 * parser de descenso recursivo escrito a mano, con una gramática cerrada
 * (números, identificadores `[a-z][a-z0-9_]*`, `+ - * /`, paréntesis).
 * Cualquier otro carácter, token sobrante, identificador desconocido,
 * división por cero o resultado no finito se rechaza explícitamente — el
 * evaluador NUNCA propaga NaN/Infinity (D-S8, obligación también de
 * rollup.ts).
 *
 * Gramática (EBNF):
 *   expr    := term (('+' | '-') term)*
 *   term    := factor (('*' | '/') factor)*
 *   factor  := ('+' | '-')? primario
 *   primario:= NUMERO | IDENTIFICADOR | '(' expr ')'
 *
 * Un identificador seguido inmediatamente de '(' (intento de "llamada de
 * función", p. ej. `abs(x)`) NO es una llamada válida en esta gramática: el
 * identificador se consume como primario completo y el '(' que sigue queda
 * como token sobrante -> se rechaza con "token sobrante". No hay comas, no
 * hay funciones, no hay exponenciación (`^`).
 */

const LONGITUD_MAXIMA = 300;

export type ResultadoEvaluacion = { ok: true; valor: number } | { ok: false; error: string };

export type ResultadoIdentificadores =
  | { ok: true; identificadores: string[] }
  | { ok: false; error: string };

/** Error interno de parseo/evaluación — nunca se deja escapar sin capturar. */
class ErrorFormula extends Error {}

type TipoToken = 'num' | 'id' | '+' | '-' | '*' | '/' | '(' | ')' | 'fin';

interface Token {
  tipo: TipoToken;
  texto?: string;
  pos: number;
}

type NodoAst =
  | { kind: 'num'; valor: number }
  | { kind: 'id'; nombre: string }
  | { kind: 'neg'; expr: NodoAst }
  | { kind: 'bin'; op: '+' | '-' | '*' | '/'; izq: NodoAst; der: NodoAst };

function esDigito(c: string): boolean {
  return c >= '0' && c <= '9';
}

function esInicioIdentificador(c: string): boolean {
  return c >= 'a' && c <= 'z';
}

function esContinuacionIdentificador(c: string): boolean {
  return (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c === '_';
}

function tokenizar(formula: string): Token[] {
  const tokens: Token[] = [];
  const n = formula.length;
  let i = 0;

  while (i < n) {
    const c = formula[i];

    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      i++;
      continue;
    }

    if (c === '+' || c === '-' || c === '*' || c === '/' || c === '(' || c === ')') {
      tokens.push({ tipo: c as TipoToken, pos: i });
      i++;
      continue;
    }

    if (esDigito(c)) {
      let j = i + 1;
      while (j < n && esDigito(formula[j])) j++;
      if (formula[j] === '.') {
        j++;
        const inicioDecimales = j;
        while (j < n && esDigito(formula[j])) j++;
        if (j === inicioDecimales) {
          throw new ErrorFormula(`número mal formado en la posición ${i}`);
        }
      }
      tokens.push({ tipo: 'num', texto: formula.slice(i, j), pos: i });
      i = j;
      continue;
    }

    if (esInicioIdentificador(c)) {
      let j = i + 1;
      while (j < n && esContinuacionIdentificador(formula[j])) j++;
      tokens.push({ tipo: 'id', texto: formula.slice(i, j), pos: i });
      i = j;
      continue;
    }

    throw new ErrorFormula(`carácter no permitido "${c}" en la posición ${i}`);
  }

  tokens.push({ tipo: 'fin', pos: n });
  return tokens;
}

function parsear(tokens: Token[]): NodoAst {
  let pos = 0;
  const pico = (): Token => tokens[pos];
  const avanzar = (): Token => tokens[pos++];

  function parseExpr(): NodoAst {
    let nodo = parseTerm();
    while (pico().tipo === '+' || pico().tipo === '-') {
      const op = avanzar().tipo as '+' | '-';
      const der = parseTerm();
      nodo = { kind: 'bin', op, izq: nodo, der };
    }
    return nodo;
  }

  function parseTerm(): NodoAst {
    let nodo = parseFactor();
    while (pico().tipo === '*' || pico().tipo === '/') {
      const op = avanzar().tipo as '*' | '/';
      const der = parseFactor();
      nodo = { kind: 'bin', op, izq: nodo, der };
    }
    return nodo;
  }

  function parseFactor(): NodoAst {
    if (pico().tipo === '-') {
      avanzar();
      return { kind: 'neg', expr: parseFactor() };
    }
    if (pico().tipo === '+') {
      avanzar();
      return parseFactor();
    }
    return parsePrimario();
  }

  function parsePrimario(): NodoAst {
    const t = pico();
    if (t.tipo === 'num') {
      avanzar();
      const valor = Number(t.texto);
      if (!Number.isFinite(valor)) {
        throw new ErrorFormula(`número inválido "${t.texto}"`);
      }
      return { kind: 'num', valor };
    }
    if (t.tipo === 'id') {
      avanzar();
      return { kind: 'id', nombre: t.texto! };
    }
    if (t.tipo === '(') {
      avanzar();
      const inner = parseExpr();
      if (pico().tipo !== ')') {
        throw new ErrorFormula(`paréntesis sin cerrar (posición ${pico().pos})`);
      }
      avanzar();
      return inner;
    }
    throw new ErrorFormula(`token inesperado en la posición ${t.pos}`);
  }

  const ast = parseExpr();
  if (pico().tipo !== 'fin') {
    throw new ErrorFormula(`token sobrante en la posición ${pico().pos}`);
  }
  return ast;
}

function comprobarNumero(v: number): number {
  if (typeof v !== 'number' || Number.isNaN(v) || !Number.isFinite(v)) {
    throw new ErrorFormula('resultado no numérico (NaN/Infinity)');
  }
  return v;
}

function evaluarAst(ast: NodoAst, valores: Record<string, number>): number {
  switch (ast.kind) {
    case 'num':
      return comprobarNumero(ast.valor);
    case 'id': {
      const v = valores[ast.nombre];
      if (v === undefined || v === null) {
        throw new ErrorFormula(`parámetro desconocido: ${ast.nombre}`);
      }
      return comprobarNumero(v);
    }
    case 'neg':
      return comprobarNumero(-evaluarAst(ast.expr, valores));
    case 'bin': {
      const izq = evaluarAst(ast.izq, valores);
      const der = evaluarAst(ast.der, valores);
      switch (ast.op) {
        case '+':
          return comprobarNumero(izq + der);
        case '-':
          return comprobarNumero(izq - der);
        case '*':
          return comprobarNumero(izq * der);
        case '/':
          if (der === 0) {
            throw new ErrorFormula('división por cero');
          }
          return comprobarNumero(izq / der);
      }
    }
  }
}

function recolectarIdentificadores(ast: NodoAst, acc: string[], vistos: Set<string>): void {
  switch (ast.kind) {
    case 'num':
      return;
    case 'id':
      if (!vistos.has(ast.nombre)) {
        vistos.add(ast.nombre);
        acc.push(ast.nombre);
      }
      return;
    case 'neg':
      recolectarIdentificadores(ast.expr, acc, vistos);
      return;
    case 'bin':
      recolectarIdentificadores(ast.izq, acc, vistos);
      recolectarIdentificadores(ast.der, acc, vistos);
      return;
  }
}

function validarEntrada(formula: unknown): asserts formula is string {
  if (typeof formula !== 'string' || formula.length === 0) {
    throw new ErrorFormula('fórmula vacía');
  }
  if (formula.length > LONGITUD_MAXIMA) {
    throw new ErrorFormula(`fórmula demasiado larga (máx ${LONGITUD_MAXIMA} caracteres, recibida ${formula.length})`);
  }
}

/**
 * Evalúa una fórmula contra un mapa `{clave -> valor}` YA elegido por el
 * llamador (lado actual = valor_actual; lado RC = valor_rc ?? valor_actual;
 * ver resolver.ts). Función pura: no consulta la BD, no muta nada.
 */
export function evaluar(formula: string, valores: Record<string, number>): ResultadoEvaluacion {
  try {
    validarEntrada(formula);
    const tokens = tokenizar(formula);
    const ast = parsear(tokens);
    const valor = evaluarAst(ast, valores);
    return { ok: true, valor };
  } catch (err) {
    if (err instanceof ErrorFormula) {
      return { ok: false, error: err.message };
    }
    // Defensa en profundidad: cualquier fallo inesperado nunca debe propagar
    // NaN ni tirar abajo el llamador — se reporta como fórmula inválida.
    return { ok: false, error: 'fórmula inválida' };
  }
}

/**
 * Extrae los identificadores (claves de `sim_parametros`) referenciados por
 * una fórmula, SIN evaluarla — usado por resolver.ts para construir el
 * grafo de dependencias de parámetros derivados (detección de ciclos,
 * D-S2b) y por el admin para el aviso "dónde se usa" al borrar un
 * parámetro. También sirve como validación de sintaxis en seco.
 */
export function extraerIdentificadores(formula: string): ResultadoIdentificadores {
  try {
    validarEntrada(formula);
    const tokens = tokenizar(formula);
    const ast = parsear(tokens);
    const acc: string[] = [];
    recolectarIdentificadores(ast, acc, new Set());
    return { ok: true, identificadores: acc };
  } catch (err) {
    if (err instanceof ErrorFormula) {
      return { ok: false, error: err.message };
    }
    return { ok: false, error: 'fórmula inválida' };
  }
}
