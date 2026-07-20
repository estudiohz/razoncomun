// lib/brain/ingest/src/pgClient.mjs
//
// Cliente mínimo contra el endpoint HTTPS de pg-meta (Kong: /pg/query ->
// http://meta:8080/query, solo service_role/grupo "admin" — ver kong.yml y
// supabase/migrations/0012_brain.sql). Usamos raw SQL de texto plano porque
// pg-meta no soporta placeholders parametrizados; el escapado seguro lo hace
// sqlLiteral.mjs ANTES de construir la sentencia.
//
// Ventaja deliberada de este enfoque frente a una conexión TCP directa a
// `db:5432`: el mismo código funciona en producción (dentro del VPS) y en
// desarrollo/pruebas (esta máquina, sin acceso a la red interna del VPS) —
// visto en la práctica al construir y probar este pipeline.

import { config } from "./config.mjs";

export class PgQueryError extends Error {
  constructor(message, { query, responseBody } = {}) {
    super(message);
    this.name = "PgQueryError";
    this.query = query;
    this.responseBody = responseBody;
  }
}

/**
 * Ejecuta una sentencia SQL contra Postgres vía pg-meta.
 * @param {string} sql
 * @returns {Promise<any[]>} filas devueltas (array, puede estar vacío)
 */
export async function pgQuery(sql) {
  const url = `${config.supabaseUrl}/pg/query`;
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    });
  } catch (err) {
    throw new PgQueryError(`No se pudo alcanzar ${url}: ${err.message}`, { query: sql });
  }

  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : [];
  } catch {
    throw new PgQueryError(
      `Respuesta no-JSON de pg-meta (status ${res.status}): ${text.slice(0, 500)}`,
      { query: sql, responseBody: text }
    );
  }

  if (!res.ok || (body && body.error)) {
    const msg = body?.error || body?.message || `HTTP ${res.status}`;
    throw new PgQueryError(`Error SQL: ${msg}`, { query: sql, responseBody: body });
  }

  return Array.isArray(body) ? body : [];
}

/** Ejecuta varias sentencias en secuencia (pg-meta /query no soporta transacciones
 *  explícitas multi-statement de forma fiable entre llamadas HTTP separadas;
 *  para nuestro caso de uso — borrar-e-insertar por lote — el semáforo de
 *  idempotencia es el propio contenido, no una transacción ACID estricta). */
export async function pgQuerySequence(statements) {
  const results = [];
  for (const sql of statements) {
    results.push(await pgQuery(sql));
  }
  return results;
}
