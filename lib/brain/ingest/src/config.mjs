// lib/brain/ingest/src/config.mjs
//
// Configuración centralizada del job de ingesta. Todo por variables de
// entorno — nada de secretos hardcodeados (repo público, C5 revision-seguridad.md).
//
// Ver .env.example para la lista completa documentada.

function required(name, { allowEmptyInMock } = {}) {
  const v = process.env[name];
  if (!v && !allowEmptyInMock) {
    throw new Error(
      `Falta la variable de entorno ${name}. Copia .env.example a .env y complétala (o pásala como env var del servicio en Dokploy).`
    );
  }
  return v;
}

const embeddingsProvider = (process.env.EMBEDDINGS_PROVIDER || "ollama").toLowerCase();

export const config = {
  // --- Postgres, vía el endpoint HTTPS de pg-meta (Kong ruta /pg/*, admin-only) ---
  // Decisión de este agente (rc-08-brain, Ola 1): usar el endpoint HTTPS público
  // ya expuesto (dev-api.razoncomun.com/pg/*) en vez de una conexión TCP directa
  // a `db:5432`. Motivo: evita depender de que el job se una a la red Docker
  // interna del stack de Supabase (`rc-supabase-internal`, no declarada
  // `external` en infra/docker-compose.supabase.yml — unirse a ella desde un
  // stack Compose distinto de Dokploy exige conocer el nombre real que Docker
  // le asignó, ver README §"Redes"). El endpoint HTTPS ya está verificado
  // funcionando (D-005) y service_role lo autoriza (kong.yml, grupo "admin").
  // Es el MISMO camino tanto en producción (dentro del VPS) como en pruebas
  // locales (esta máquina) — un solo código, probado de verdad en ambos sitios.
  supabaseUrl: (required("SUPABASE_PUBLIC_URL")).replace(/\/+$/, ""),
  serviceRoleKey: required("SERVICE_ROLE_KEY"),

  // --- Ollama (embeddings bge-m3) ---
  // Solo alcanzable desde dentro de la red `rc-ollama-internal` del VPS.
  // En local, usar EMBEDDINGS_PROVIDER=mock (ver src/embeddings.mjs).
  ollamaUrl: (process.env.OLLAMA_URL || "http://ollama:11434").replace(/\/+$/, ""),
  ollamaModel: process.env.OLLAMA_MODEL || "bge-m3",
  embeddingsProvider, // 'ollama' | 'mock'
  embeddingDims: 1024,

  // --- Corpus de documentos (docs/ideario, docs/marca, docs/referencias, docs/vision) ---
  // Ya NO es un bind mount (ver D-010, docs/tecnico/decisiones-construccion.md:
  // exigía SSH que no estaba disponible). Vive en el bucket PRIVADO de
  // Supabase Storage "corpus", leído vía el mismo SUPABASE_PUBLIC_URL +
  // SERVICE_ROLE_KEY de arriba -- ver src/connectors/corpusStorage.mjs.
  // docs/tecnico/ NO está en el bucket a propósito y este código no lo asume
  // aunque apareciera: ver FOLDER_VISIBILITY en corpusStorage.mjs.
  corpusStorageBucket: process.env.CORPUS_STORAGE_BUCKET || "corpus",

  // --- Chunking ---
  chunkTargetChars: parseInt(process.env.CHUNK_TARGET_CHARS || "1100", 10),
  chunkOverlapChars: parseInt(process.env.CHUNK_OVERLAP_CHARS || "150", 10),

  // --- Lote de inserción / concurrencia de embeddings ---
  insertBatchSize: parseInt(process.env.INSERT_BATCH_SIZE || "10", 10),
  embedConcurrency: parseInt(process.env.EMBED_CONCURRENCY || "4", 10),

  // --- Marcador de filas de prueba (para poder limpiarlas sin tocar datos reales) ---
  testRun: process.env.RC_BRAIN_TEST_RUN === "1",
};

export function assertMockAllowed() {
  if (config.embeddingsProvider === "mock" && !config.testRun) {
    throw new Error(
      "EMBEDDINGS_PROVIDER=mock solo está permitido con RC_BRAIN_TEST_RUN=1 (para no escribir " +
        "embeddings falsos en el corpus real por accidente). Producción SIEMPRE usa 'ollama'."
    );
  }
}
