// lib/brain/ingest/src/connectors/manifesto.mjs
//
// Fuente: tabla manifesto_points (30 puntos del programa fundacional, ya
// sembrada por rc-02-datos). Es programa público por definición -> visibility
// SIEMPRE 'public'.
//
// Nota de esquema (para el informe, no se toca el esquema): `ref_id` en
// brain_documents es `uuid NULL`, pero `manifesto_points.id` es `int` (1..30).
// No son compatibles como referencia directa (uuid vs int), así que dejamos
// `ref_id = NULL` para estos documentos y guardamos la trazabilidad real en
// `metadata.point_id` (int) -- de ahí también se deriva el borrado idempotente.

import { pgQuery } from "../pgClient.mjs";
import { chunkShortText } from "../chunking.mjs";
import { config } from "../config.mjs";

export const SOURCE = "manifiesto";

export async function fetchManifestoDocuments() {
  const rows = await pgQuery(
    "select id, title, body, version, is_core from manifesto_points order by id;"
  );

  return rows.map((row) => {
    const fullText = `Punto ${row.id}. ${row.title}\n\n${row.body}`;
    const chunks = chunkShortText(fullText, {
      targetChars: config.chunkTargetChars,
      overlapChars: config.chunkOverlapChars,
    });
    return {
      source: SOURCE,
      refId: null, // ver nota de esquema arriba
      visibility: "public",
      idempotencyKey: { point_id: row.id }, // usado para el DELETE previo al re-indexar
      chunks: chunks.map((c, i) => ({
        text: c.text,
        metadata: {
          point_id: row.id,
          title: row.title,
          version: row.version,
          is_core: row.is_core,
          chunk_index: i,
          chunk_count: chunks.length,
        },
      })),
    };
  });
}
