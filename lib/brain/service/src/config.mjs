// lib/brain/service/src/config.mjs
//
// Config del servicio persistente "rc-brain-service" -- el cerebro que atiende
// al chat público, al bot de Discord (canal de equipo) y al clasificador de
// Opina. Ola 3 de rc-08-brain (docs/tecnico/plan-lanzamiento.md). Todo por
// variable de entorno, nada hardcodeado (repo público).

function required(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Falta la variable de entorno ${name}. Copia .env.example a .env (local) o pégala en Dokploy.`
    );
  }
  return v;
}

const embeddingsProvider = (process.env.EMBEDDINGS_PROVIDER || "ollama").toLowerCase();

export const config = {
  port: parseInt(process.env.PORT || "8787", 10),

  // --- Postgres vía el endpoint HTTPS de pg-meta (mismo patrón que rc-brain-ingest) ---
  supabaseUrl: required("SUPABASE_PUBLIC_URL").replace(/\/+$/, ""),
  serviceRoleKey: required("SERVICE_ROLE_KEY"),

  // --- Ollama (embeddings de la CONSULTA del usuario en tiempo real) ---
  ollamaUrl: (process.env.OLLAMA_URL || "http://ollama:11434").replace(/\/+$/, ""),
  ollamaModel: process.env.OLLAMA_MODEL || "bge-m3",
  embeddingsProvider, // 'ollama' | 'mock' -- 'mock' SOLO con RC_BRAIN_TEST_RUN=1, ver embeddings.mjs
  embeddingDims: 1024,
  testRun: process.env.RC_BRAIN_TEST_RUN === "1",

  // --- Anthropic (generación / clasificación -- NUNCA embeddings, decisión cerrada) ---
  // Sigue siendo el FALLBACK de entorno cuando no hay clave maestra o no hay
  // ninguna fila activa en `ai_provider_credentials` (ver credentialStore.mjs) --
  // así el servicio arranca igual que antes de D-016 si Sergio no ha tocado
  // el panel todavía. anthropicVersion es un detalle de protocolo del
  // adaptador Anthropic (header "anthropic-version"), no de credenciales.
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  anthropicModel: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
  anthropicVersion: process.env.ANTHROPIC_VERSION || "2023-06-01",

  // --- Capa multiproveedor (D-016): clave maestra para descifrar la credencial
  // activa en `ai_provider_credentials` (pgcrypto). NUNCA se guarda en la BD --
  // solo aquí, en el entorno del servicio. Sin ella, el servicio cae al
  // fallback de entorno (ANTHROPIC_API_KEY) de arriba -- fail-soft, no fail-closed,
  // porque perder la generación entera por no tener aún esta clave sería peor
  // que servir con el proveedor de entorno mientras Sergio configura el panel.
  aiCredentialsMasterKey: process.env.AI_CREDENTIALS_MASTER_KEY || "",
  // Cuánto tiempo se cachea en memoria la credencial activa antes de volver a
  // leerla de la BD -- el requisito es que un cambio de proveedor desde el
  // panel "surta efecto sin reiniciar el contenedor", no que cada petición
  // pague una consulta a Postgres. 20s es un compromiso: bajo para notarse
  // rápido en producción, sin flood de queries por petición de chat.
  aiCredentialsCacheTtlMs: parseInt(process.env.AI_CREDENTIALS_CACHE_TTL_MS || "20000", 10),
  // Intervalo del vigilante de cambio de proveedor (providerWatcher.mjs) --
  // dispara la suite de neutralidad + revierte automáticamente si el cambio
  // detectado cae por debajo del umbral. Deliberadamente más lento que el TTL
  // de la caché (que ya deja el chat/Opina funcionando con el proveedor nuevo
  // de inmediato): esto es la red de seguridad de neutralidad, no la ruta
  // caliente de servir respuestas.
  aiProviderWatchIntervalMs: parseInt(process.env.AI_PROVIDER_WATCH_INTERVAL_MS || "20000", 10),
  aiNeutralityMinPct: parseFloat(process.env.AI_NEUTRALITY_MIN_PCT || "95"),

  // --- Umbral de "fuera de corpus" (calibrado en Ola 1, controlQuestions.mjs) ---
  outOfCorpusThreshold: parseFloat(process.env.OUT_OF_CORPUS_THRESHOLD || "0.55"),
  retrievalLimit: parseInt(process.env.RETRIEVAL_LIMIT || "5", 10),

  // --- Token compartido para el endpoint interno (/chat-team, /classify-opinion,
  // /neutrality-suite/run) -- NUNCA público, solo el bot de Discord / n8n lo usan,
  // por red interna. Sin esto, esas rutas devuelven 501 (fail-closed, no fail-open). ---
  internalToken: process.env.BRAIN_INTERNAL_TOKEN || "",

  // --- Rate limit (I4, revision-seguridad.md) ---
  rateLimitPerIpPerHour: parseInt(process.env.RATE_LIMIT_PER_IP_PER_HOUR || "30", 10),
  rateLimitPerSessionPerHour: parseInt(process.env.RATE_LIMIT_PER_SESSION_PER_HOUR || "20", 10),
};

export function assertMockAllowed() {
  if (config.embeddingsProvider === "mock" && !config.testRun) {
    throw new Error(
      "EMBEDDINGS_PROVIDER=mock solo está permitido con RC_BRAIN_TEST_RUN=1. Producción SIEMPRE usa 'ollama'."
    );
  }
}
