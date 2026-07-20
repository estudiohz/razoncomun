// lib/brain/ingest/src/sqlLiteral.mjs
//
// Escapado manual de literales SQL. Deliberadamente SIN dependencias (ni
// `pg`, ni `pg-format`): el endpoint de pg-meta (/pg/query) solo acepta SQL
// como texto plano -- no hay placeholders parametrizados server-side -- así
// que el escapado seguro lo hacemos aquí, una vez, bien probado.
//
// Asume standard_conforming_strings=on (default de Postgres desde 9.1, y lo
// es en supabase/postgres:17.6.1.136): basta con doblar comillas simples,
// las barras invertidas NO son de escape.

const NUL_CHAR_CODE = 0;

export function escapeStringLiteral(value) {
  if (value === null || value === undefined) return "NULL";
  const s = String(value);
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) === NUL_CHAR_CODE) {
      throw new Error("El texto contiene un byte NUL, Postgres no lo admite en columnas text.");
    }
  }
  return "'" + s.replace(/'/g, "''") + "'";
}

export function toVectorLiteral(embedding, expectedDims) {
  if (!Array.isArray(embedding)) {
    throw new Error("El embedding debe ser un array de números.");
  }
  if (expectedDims && embedding.length !== expectedDims) {
    throw new Error(
      `Dimensión de embedding inesperada: ${embedding.length} (se esperaban ${expectedDims}).`
    );
  }
  const nums = embedding.map((x) => {
    const n = Number(x);
    if (!Number.isFinite(n)) throw new Error("El embedding contiene un valor no finito.");
    return n;
  });
  return "'[" + nums.join(",") + "]'::vector";
}

export function toJsonbLiteral(obj) {
  if (obj === null || obj === undefined) return "NULL";
  return escapeStringLiteral(JSON.stringify(obj)) + "::jsonb";
}

export function toUuidLiteral(value) {
  if (value === null || value === undefined) return "NULL";
  // Validación mínima de forma UUID para no colar texto arbitrario en una
  // columna uuid (Postgres lo rechazaría igualmente, pero fallar aquí da
  // un mensaje más claro).
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(value)) throw new Error(`"${value}" no parece un UUID válido.`);
  return escapeStringLiteral(value) + "::uuid";
}

export function toIntLiteral(value) {
  if (value === null || value === undefined) return "NULL";
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) throw new Error(`"${value}" no es un entero válido.`);
  return String(n);
}
