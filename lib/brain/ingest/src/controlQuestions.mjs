#!/usr/bin/env node
// lib/brain/ingest/src/controlQuestions.mjs
//
// Suite de verificación del GATE de esta ola: 5 preguntas de control (deben
// devolver el chunk correcto por similitud coseno), 3 preguntas fuera del
// corpus (deben devolver similitud baja -- no hay componente de chat/generación
// todavía, Ola 3, así que aquí solo medimos la señal de recuperación cruda) y
// una comprobación de que el índice ivfflat se usa de verdad (EXPLAIN).
//
// Uso:
//   node src/controlQuestions.mjs                 # usa EMBEDDINGS_PROVIDER del entorno
//
// Requiere que el corpus ya esté ingerido (ver index.mjs) con el proveedor
// "ollama" para que el resultado sea semánticamente significativo -- con
// EMBEDDINGS_PROVIDER=mock los resultados NO prueban recuperación semántica
// real, solo que la tubería SQL/orden-por-similitud funciona mecánicamente.

import { pgQuery } from "./pgClient.mjs";
import { embed } from "./embeddings.mjs";
import { toVectorLiteral } from "./sqlLiteral.mjs";
import { config } from "./config.mjs";

const CONTROL_QUESTIONS = [
  { q: "¿Qué propone Razón Común para los autónomos y sus cotizaciones?", expectPointId: 17 },
  { q: "¿Cómo plantea el partido acabar con los aforamientos de los políticos?", expectPointId: 11 },
  { q: "¿Qué es la Agencia de Datos Contrastados?", expectPointId: 20 },
  { q: "¿Qué dice el programa sobre el desahucio y la vivienda?", expectPointId: 15 },
  { q: "¿Cómo funciona la rectificación popular para cesar a un cargo corrupto?", expectPointId: 7 },
];

const OUT_OF_CORPUS_QUESTIONS = [
  "¿Cuál es la receta de la tortilla de patatas perfecta?",
  "¿Quién ganó el Balón de Oro en 1998?",
  "¿Qué opina Razón Común sobre la exploración espacial tripulada a Marte?",
];

// Umbral de similitud coseno por debajo del cual consideramos que "no hay
// nada relevante en el corpus" -- calibrar con datos reales tras el primer
// despliegue; 0.55 es un punto de partida conservador para bge-m3 en español.
const OUT_OF_CORPUS_THRESHOLD = 0.55;

async function topMatches(questionText, { visibility = null, limit = 3 } = {}) {
  const vec = await embed(questionText);
  const vecLiteral = toVectorLiteral(vec, config.embeddingDims);
  const visClause = visibility ? `and visibility = '${visibility}'` : "";
  const sql =
    `select source, chunk, metadata, 1 - (embedding <=> ${vecLiteral}) as similarity\n` +
    `from brain_documents\n` +
    `where true ${visClause}\n` +
    `order by embedding <=> ${vecLiteral}\n` +
    `limit ${limit};`;
  return pgQuery(sql);
}

async function runControlQuestions() {
  console.log("=== 1. Preguntas de control (esperado: cita el punto correcto) ===\n");
  let passed = 0;
  for (const { q, expectPointId } of CONTROL_QUESTIONS) {
    const matches = await topMatches(q, { limit: 3 });
    const top = matches[0];
    const topPointId = top?.metadata?.point_id;
    const ok = topPointId === expectPointId;
    if (ok) passed += 1;
    console.log(`Pregunta: "${q}"`);
    console.log(`  Esperado: punto ${expectPointId}`);
    console.log(
      `  Top-1: punto ${topPointId ?? "?"} (similitud ${top ? top.similarity.toFixed(4) : "n/a"}) -> ${
        ok ? "OK" : "FALLO"
      }`
    );
    console.log(`  Chunk: ${top ? JSON.stringify(top.chunk).slice(0, 140) : "(sin resultados)"}`);
    console.log("");
  }
  console.log(`Resultado: ${passed}/${CONTROL_QUESTIONS.length} correctas.\n`);
  return { passed, total: CONTROL_QUESTIONS.length };
}

async function runOutOfCorpusQuestions() {
  console.log("=== 2. Preguntas fuera de corpus (esperado: similitud baja, ninguna relevante) ===\n");
  let passed = 0;
  for (const q of OUT_OF_CORPUS_QUESTIONS) {
    const matches = await topMatches(q, { limit: 1 });
    const top = matches[0];
    const sim = top?.similarity ?? 0;
    const ok = sim < OUT_OF_CORPUS_THRESHOLD;
    if (ok) passed += 1;
    console.log(`Pregunta: "${q}"`);
    console.log(
      `  Similitud top-1: ${sim.toFixed(4)} (umbral ${OUT_OF_CORPUS_THRESHOLD}) -> ${
        ok ? "OK (bajo umbral, correcto que no hay match)" : "FALLO (demasiado alta)"
      }`
    );
    console.log("");
  }
  console.log(`Resultado: ${passed}/${OUT_OF_CORPUS_QUESTIONS.length} correctas.\n`);
  return { passed, total: OUT_OF_CORPUS_QUESTIONS.length };
}

async function checkIndexUsage() {
  console.log("=== 3. Verificación de dimensión + uso del índice ivfflat ===\n");
  const dims = await pgQuery(
    "select atttypmod as dims from pg_attribute where attrelid = 'brain_documents'::regclass and attname = 'embedding';"
  );
  console.log(`Dimensión de la columna embedding: ${dims[0]?.dims}`);

  const probeVec = await embed("consulta de sondeo para comprobar el plan de ejecución");
  const vecLiteral = toVectorLiteral(probeVec, config.embeddingDims);
  const plan = await pgQuery(
    `explain (format json) select id from brain_documents order by embedding <=> ${vecLiteral} limit 5;`
  );
  const planText = JSON.stringify(plan);
  const usesIndex = planText.includes("brain_documents_embedding_ivfflat_idx") || planText.includes("Index Scan");
  console.log(`Plan de ejecución: ${planText.slice(0, 600)}`);
  console.log(`¿Usa el índice ivfflat?: ${usesIndex ? "SÍ" : "NO (revisar -- puede ser Seq Scan por pocas filas)"}`);
  return { dims: dims[0]?.dims, usesIndex, plan };
}

async function main() {
  const control = await runControlQuestions();
  const outOfCorpus = await runOutOfCorpusQuestions();
  const indexCheck = await checkIndexUsage();

  console.log("=== Resumen final ===");
  console.log(`Control: ${control.passed}/${control.total}`);
  console.log(`Fuera de corpus: ${outOfCorpus.passed}/${outOfCorpus.total}`);
  console.log(`Dimensión: ${indexCheck.dims} · índice usado: ${indexCheck.usesIndex}`);
}

main().catch((err) => {
  console.error("VERIFICACIÓN FALLIDA:", err.message);
  process.exit(1);
});
