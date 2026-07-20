// lib/brain/service/src/sqlLiteral.mjs
//
// Copia deliberada de lib/brain/ingest/src/sqlLiteral.mjs (no se importa entre
// directorios: cada servicio se construye con Docker con su propio contexto
// de build, `lib/brain/ingest/` y `lib/brain/service/` respectivamente -- ver
// infra/GUIA-DOKPLOY.md §6, apps/web usa el mismo patrón por la misma razón).
// Si se cambia aquí, replicar en ingest/ y viceversa -- son ~40 líneas, el
// coste de mantenerlas en sync es menor que el de acoplar los builds.

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
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(value)) throw new Error(`"${value}" no parece un UUID válido.`);
  return escapeStringLiteral(value) + "::uuid";
}

export function toIntArrayLiteral(values) {
  if (!values || values.length === 0) return "'{}'::int[]";
  const nums = values.map((v) => {
    const n = parseInt(v, 10);
    if (!Number.isFinite(n)) throw new Error(`"${v}" no es un entero válido.`);
    return n;
  });
  return "'{" + nums.join(",") + "}'::int[]";
}

export function toTextArrayLiteral(values) {
  if (!values || values.length === 0) return "'{}'::text[]";
  // Escapado de array literal de Postgres: cada elemento entre comillas dobles,
  // backslash y comilla doble escapadas.
  const items = values.map((v) => {
    const s = String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `"${s}"`;
  });
  return escapeStringLiteral("{" + items.join(",") + "}") + "::text[]";
}
