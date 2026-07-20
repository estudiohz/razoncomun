// lib/brain/service/src/pgClient.mjs
// Copia adaptada de lib/brain/ingest/src/pgClient.mjs -- mismo endpoint HTTPS
// de pg-meta (POST /pg/query, service_role), ver ese archivo para el porqué.
// UTF-8 explícito en el Content-Type (bug D-009, decisiones-construccion.md):
// pg-meta interpreta el body como Latin-1 si el charset no se declara, y
// castellano con tildes se corrompe en silencio (200 OK, datos rotos).

import { config } from "./config.mjs";

export class PgQueryError extends Error {
  constructor(message, { query, responseBody } = {}) {
    super(message);
    this.name = "PgQueryError";
    this.query = query;
    this.responseBody = responseBody;
  }
}

export async function pgQuery(sql) {
  const url = `${config.supabaseUrl}/pg/query`;
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json; charset=utf-8",
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
