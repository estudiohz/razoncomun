// lib/brain/ingest/src/ingest.mjs
//
// Orquestador de la ingesta: para cada "documento" que entrega un conector
// (manifiesto.mjs, corpusDocs.mjs...), trocea, genera embeddings y hace un
// upsert idempotente en brain_documents (DELETE por clave de idempotencia +
// INSERT de los chunks frescos, en ese orden, así una re-ejecución nunca
// duplica ni deja basura de una versión anterior del documento).

import { pgQuery } from "./pgClient.mjs";
import { embedBatch } from "./embeddings.mjs";
import { escapeStringLiteral, toVectorLiteral, toJsonbLiteral, toUuidLiteral } from "./sqlLiteral.mjs";
import { config } from "./config.mjs";

function buildWhereClause(source, idempotencyKey) {
  const conditions = [`source = ${escapeStringLiteral(source)}`];
  for (const [key, value] of Object.entries(idempotencyKey)) {
    if (typeof value === "number") {
      conditions.push(`(metadata->>'${key}')::int = ${value}`);
    } else {
      conditions.push(`metadata->>'${key}' = ${escapeStringLiteral(String(value))}`);
    }
  }
  return conditions.join(" and ");
}

function buildInsertSql(rows) {
  const values = rows
    .map(
      (r) =>
        `(${escapeStringLiteral(r.source)}, ${r.refId ? toUuidLiteral(r.refId) : "NULL"}, ` +
        `${escapeStringLiteral(r.text)}, ${toVectorLiteral(r.embedding, config.embeddingDims)}, ` +
        `${escapeStringLiteral(r.visibility)}, ${toJsonbLiteral(r.metadata)})`
    )
    .join(",\n       ");
  return (
    `insert into brain_documents (source, ref_id, chunk, embedding, visibility, metadata)\n` +
    `values ${values};`
  );
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Ingresa una lista de "documentos" (forma que entregan los conectores) en
 * brain_documents. Devuelve un resumen con conteos reales.
 */
export async function ingestDocuments(documents, { dryRun = false, log = console.log } = {}) {
  const summary = { documents: 0, chunksInserted: 0, deletedRows: 0, bySource: {} };

  for (const doc of documents) {
    summary.documents += 1;
    summary.bySource[doc.source] = summary.bySource[doc.source] || { docs: 0, chunks: 0 };
    summary.bySource[doc.source].docs += 1;

    const whereClause = buildWhereClause(doc.source, doc.idempotencyKey);
    if (!dryRun) {
      const before = await pgQuery(
        `select count(*)::int as n from brain_documents where ${whereClause};`
      );
      await pgQuery(`delete from brain_documents where ${whereClause};`);
      summary.deletedRows += before[0]?.n ?? 0;
    }

    const texts = doc.chunks.map((c) => c.text);
    const embeddings = await embedBatch(texts);

    const rows = doc.chunks.map((c, i) => ({
      source: doc.source,
      refId: doc.refId,
      text: c.text,
      embedding: embeddings[i],
      visibility: doc.visibility,
      metadata: c.metadata,
    }));

    if (!dryRun) {
      for (const batch of chunkArray(rows, config.insertBatchSize)) {
        await pgQuery(buildInsertSql(batch));
      }
    }

    summary.chunksInserted += rows.length;
    summary.bySource[doc.source].chunks += rows.length;
    log(
      `  · ${doc.source} ${JSON.stringify(doc.idempotencyKey)} -> ${rows.length} chunk(s)` +
        (dryRun ? " [dry-run, no escrito]" : "")
    );
  }

  return summary;
}
