// lib/brain/service/src/retrieval.mjs
//
// Recuperación por similitud coseno contra brain_documents. Este módulo es
// el ÚNICO sitio donde se decide qué visibilidad puede leer cada canal --
// por diseño, NO por RLS (brain_documents está cerrada por completo a
// anon/authenticated, migración 0012_brain.sql; service_role la bypasa
// siempre). Si esta función se equivoca, el chat público filtra contenido
// interno -- por eso el filtro va aquí, en una única función, nunca repetido
// ad-hoc en cada endpoint (ver server.mjs: /chat SIEMPRE llama con
// visibility:'public', nunca con null, y no hay forma de que el body de la
// petición HTTP lo sobreescriba -- se ignora cualquier campo "visibility" que
// llegara del cliente).

import { pgQuery } from "./pgClient.mjs";
import { embed } from "./embeddings.mjs";
import { toVectorLiteral } from "./sqlLiteral.mjs";
import { config } from "./config.mjs";

/**
 * @param {string} queryText
 * @param {{visibility: 'public'|null, limit?: number}} opts
 *   visibility: 'public' para el chat ciudadano (ÚNICO valor permitido ahí).
 *               null para el canal de equipo (Discord interno) -- accede a
 *               todo el corpus, público + interno.
 */
export async function retrieve(queryText, { visibility, limit = config.retrievalLimit } = {}) {
  if (visibility !== "public" && visibility !== null) {
    throw new Error(
      `retrieve(): visibility debe ser 'public' o null explícitamente, recibido: ${JSON.stringify(visibility)}`
    );
  }
  const vec = await embed(queryText);
  const vecLiteral = toVectorLiteral(vec, config.embeddingDims);
  const visClause = visibility === "public" ? `and visibility = 'public'` : "";
  const sql =
    `select id, source, ref_id, chunk, visibility, metadata, 1 - (embedding <=> ${vecLiteral}) as similarity\n` +
    `from brain_documents\n` +
    `where true ${visClause}\n` +
    `order by embedding <=> ${vecLiteral}\n` +
    `limit ${parseInt(limit, 10)};`;
  const rows = await pgQuery(sql);

  // Cinturón y tirantes: aunque la query ya filtra, si por algún motivo
  // llegara una fila 'internal' en un contexto 'public' (bug futuro, columna
  // renombrada, etc.) se descarta aquí también antes de que llegue al LLM.
  if (visibility === "public") {
    return rows.filter((r) => r.visibility === "public");
  }
  return rows;
}

export function bestSimilarity(rows) {
  if (!rows || rows.length === 0) return 0;
  return Math.max(...rows.map((r) => Number(r.similarity) || 0));
}
