// lib/brain/ingest/src/embeddings.mjs
//
// Genera embeddings de 1024 dims. Dos proveedores:
//  - "ollama": bge-m3 real vía el contenedor interno (producción, Ola 1 desplegada).
//  - "mock": vector determinista (hash del texto), SOLO para probar la
//    mecánica del pipeline (chunking/insert/delete/orden por similitud) sin
//    acceso a Ollama. Bloqueado salvo RC_BRAIN_TEST_RUN=1 (ver config.mjs) y
//    NUNCA usado para poblar el corpus real -- ver README "Qué se probó y qué no".

import { config } from "./config.mjs";

async function embedWithOllama(text) {
  const url = `${config.ollamaUrl}/api/embeddings`;
  const maxAttempts = 3;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: config.ollamaModel, prompt: text }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Ollama devolvió ${res.status}: ${body.slice(0, 300)}`);
      }
      const json = await res.json();
      const embedding = json.embedding;
      if (!Array.isArray(embedding) || embedding.length !== config.embeddingDims) {
        throw new Error(
          `Ollama devolvió un embedding de dimensión ${embedding?.length ?? "desconocida"}, se esperaban ${config.embeddingDims}. ` +
            `Comprobar que el modelo cargado es "${config.ollamaModel}" (docker exec -it rc-ollama ollama list).`
        );
      }
      return embedding;
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
  }
  throw new Error(`Fallo generando embedding tras ${maxAttempts} intentos: ${lastErr.message}`);
}

// PRNG determinista (mulberry32) sembrado con un hash simple del texto --
// mismo texto siempre produce el mismo vector "falso", suficiente para
// probar idempotencia y orden por similitud coseno sin necesitar semántica real.
function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function embedMock(text) {
  const rand = mulberry32(hashSeed(text));
  const vec = new Array(config.embeddingDims);
  for (let i = 0; i < config.embeddingDims; i++) vec[i] = rand() * 2 - 1;
  // Normalizar a norma unidad (bge-m3 produce embeddings normalizados --
  // comentario en 0012_brain.sql -- así el índice ivfflat/cosine se comporta igual).
  const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0));
  return vec.map((x) => x / norm);
}

export async function embed(text) {
  if (config.embeddingsProvider === "mock") {
    return embedMock(text);
  }
  return embedWithOllama(text);
}

/** Ejecuta `embed` sobre una lista de textos con concurrencia limitada. */
export async function embedBatch(texts, concurrency = config.embedConcurrency) {
  const results = new Array(texts.length);
  let next = 0;
  async function worker() {
    while (next < texts.length) {
      const i = next++;
      results[i] = await embed(texts[i]);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, texts.length) }, worker);
  await Promise.all(workers);
  return results;
}
