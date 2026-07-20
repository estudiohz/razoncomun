// lib/brain/service/src/credentialStore.mjs
//
// Resuelve "cuál es el proveedor de IA activo, y con qué credencial" (D-016).
// Único punto del servicio que sabe que ai_provider_credentials existe --
// llm.mjs (y a través de él, opinions.mjs, opinaFlow.mjs, server.mjs) solo
// llama a getActiveProviderConfig() y recibe { provider, model, apiKey }.
//
// Dos fuentes, en este orden:
//   1. Base de datos: ai_credentials_get_active(AI_CREDENTIALS_MASTER_KEY) --
//      la fila que el panel admin (rc-wt-ajustes, en paralelo) marcó active=true.
//      Requiere AI_CREDENTIALS_MASTER_KEY en el entorno de ESTE servicio (nunca
//      en la BD, ver 0016_ai_provider_credentials.sql).
//   2. Fallback de entorno: ANTHROPIC_API_KEY/ANTHROPIC_MODEL (config.mjs) --
//      el comportamiento previo a D-016, para que el servicio no se rompa si
//      AI_CREDENTIALS_MASTER_KEY todavía no está puesta o la tabla está vacía.
//
// Cacheado con TTL (config.aiCredentialsCacheTtlMs, default 20s) para que un
// cambio de proveedor desde el panel "surta efecto sin reiniciar el
// contenedor" sin que cada petición de chat pague una consulta a Postgres.
// invalidateCredentialCache() fuerza una relectura inmediata (usado por
// providerWatcher.mjs justo después de revertir).

import { config } from "./config.mjs";
import { pgQuery } from "./pgClient.mjs";
import { escapeStringLiteral } from "./sqlLiteral.mjs";

export class CredentialsNotConfiguredError extends Error {
  constructor() {
    super(
      "No hay ningún proveedor de IA configurado: ni una fila activa en ai_provider_credentials " +
        "(o falta AI_CREDENTIALS_MASTER_KEY para leerla) ni ANTHROPIC_API_KEY de entorno como " +
        "respaldo. Configura un proveedor desde el panel admin o define ANTHROPIC_API_KEY."
    );
    this.name = "CredentialsNotConfiguredError";
  }
}

// Identificador reservado para el fallback de entorno -- NUNCA colisiona con
// un uuid real de ai_provider_credentials, así el comparador de "cambio de
// proveedor" (providerWatcher.mjs) puede distinguir "estamos en modo
// fallback, no hay fila que vigilar" de un cambio real entre dos filas.
export const ENV_FALLBACK_CREDENTIAL_ID = "env-fallback";

let cache = null; // { credentialId, provider, model, apiKey, fetchedAt }
let lastSeenCredentialId; // undefined = todavía no observado (arranque del servicio)

async function fetchActiveFromDb() {
  if (!config.aiCredentialsMasterKey) return null;
  const sql = `select * from ai_credentials_get_active(${escapeStringLiteral(config.aiCredentialsMasterKey)});`;
  let rows;
  try {
    rows = await pgQuery(sql);
  } catch (err) {
    // No fail-closed aquí: si la BD no responde o la clave maestra es
    // incorrecta (pgp_sym_decrypt lanza excepción, ver comentario de la
    // función en la migración), degradamos al fallback de entorno en vez de
    // tirar el servicio entero -- el error se registra para que se note.
    console.error("[credentialStore] fallo leyendo ai_credentials_get_active():", err.message);
    return null;
  }
  if (!rows.length) return null;
  const row = rows[0];
  return { credentialId: row.id, provider: row.provider, model: row.model, apiKey: row.api_key };
}

function fallbackFromEnv() {
  if (!config.anthropicApiKey) return null;
  return {
    credentialId: ENV_FALLBACK_CREDENTIAL_ID,
    provider: "anthropic",
    model: config.anthropicModel,
    apiKey: config.anthropicApiKey,
  };
}

/**
 * Devuelve { credentialId, provider, model, apiKey, fetchedAt }. Lanza
 * CredentialsNotConfiguredError si no hay ni fila activa en BD ni fallback
 * de entorno -- el resto del servicio (llm.mjs) traduce esto al mensaje
 * histórico AnthropicNotConfiguredError para no romper el contrato ya
 * verificado con quien llama (server.mjs, opinaFlow.mjs).
 */
export async function getActiveProviderConfig({ forceRefresh = false } = {}) {
  const now = Date.now();
  if (!forceRefresh && cache && now - cache.fetchedAt < config.aiCredentialsCacheTtlMs) {
    return cache;
  }

  let resolved = await fetchActiveFromDb();
  if (!resolved) resolved = fallbackFromEnv();
  if (!resolved) throw new CredentialsNotConfiguredError();

  cache = { ...resolved, fetchedAt: now };
  return cache;
}

/** Fuerza que la próxima getActiveProviderConfig() relea la BD (usado tras un revert). */
export function invalidateCredentialCache() {
  cache = null;
}

export function peekLastSeenCredentialId() {
  return lastSeenCredentialId;
}

export function markSeenCredentialId(id) {
  lastSeenCredentialId = id;
}
