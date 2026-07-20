#!/usr/bin/env node
// lib/brain/ingest/src/index.mjs
//
// Entrypoint del job de ingesta. Uso:
//
//   node src/index.mjs --sources=manifiesto,docs [--dry-run]
//
// Variables de entorno: ver .env.example. Pensado para correr dentro de un
// contenedor Docker en el VPS (Dockerfile en esta misma carpeta), unido a la
// red `rc-ollama-internal` para poder llamar a http://ollama:11434.

import { config, assertMockAllowed } from "./config.mjs";
import { fetchManifestoDocuments } from "./connectors/manifesto.mjs";
import { fetchCorpusStorageDocuments } from "./connectors/corpusStorage.mjs";
import { ingestDocuments } from "./ingest.mjs";

function parseArgs(argv) {
  const args = { sources: ["manifiesto", "docs"], dryRun: false };
  for (const arg of argv) {
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg.startsWith("--sources=")) {
      args.sources = arg.slice("--sources=".length).split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  assertMockAllowed();

  console.log(`RC-Brain · ingesta (${new Date().toISOString()})`);
  console.log(`  proveedor de embeddings: ${config.embeddingsProvider}`);
  console.log(`  fuentes solicitadas: ${args.sources.join(", ")}`);
  console.log(`  modo: ${args.dryRun ? "dry-run (no escribe)" : "escritura real"}`);
  console.log("");

  const documents = [];

  if (args.sources.includes("manifiesto")) {
    console.log("· Leyendo manifesto_points...");
    const docs = await fetchManifestoDocuments();
    console.log(`  ${docs.length} puntos encontrados`);
    documents.push(...docs);
  }

  if (args.sources.includes("docs")) {
    console.log(`· Leyendo corpus de documentos (Supabase Storage, bucket "${config.corpusStorageBucket}")...`);
    const { docs, mojibakeScan, unknownFolders } = await fetchCorpusStorageDocuments();
    console.log(`  ${docs.length} ficheros .md encontrados`);
    console.log(
      `  comprobación de codificación: ${mojibakeScan.filesChecked} fichero(s) escaneados, ` +
        `${mojibakeScan.found.length} con mojibake (U+00C3) detectado`
    );
    if (unknownFolders.length > 0) {
      console.log(`  carpetas ignoradas (no reconocidas): ${unknownFolders.join(", ")}`);
    }
    documents.push(...docs);
  }

  if (documents.length === 0) {
    console.log("Nada que ingerir (¿fuentes desconocidas o directorios de corpus vacíos?).");
    return;
  }

  console.log("");
  console.log("· Troceando + generando embeddings + escribiendo en brain_documents...");
  const summary = await ingestDocuments(documents, { dryRun: args.dryRun });

  console.log("");
  console.log("=== Resumen ===");
  console.log(`Documentos procesados: ${summary.documents}`);
  console.log(`Chunks insertados:     ${summary.chunksInserted}`);
  console.log(`Filas borradas (re-index): ${summary.deletedRows}`);
  for (const [source, s] of Object.entries(summary.bySource)) {
    console.log(`  - ${source}: ${s.docs} documento(s), ${s.chunks} chunk(s)`);
  }
}

main().catch((err) => {
  console.error("INGESTA FALLIDA:", err.message);
  if (err.responseBody) console.error("Respuesta:", JSON.stringify(err.responseBody).slice(0, 1000));
  process.exit(1);
});
