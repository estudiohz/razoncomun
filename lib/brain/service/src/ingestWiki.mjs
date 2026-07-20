// lib/brain/service/src/ingestWiki.mjs
//
// Ingesta BAJO DEMANDA de la wiki de conocimiento (public.brain_entries),
// disparada por /admin/ingest (server.mjs) desde un botón del panel admin.
//
// Lógica vendorizada a propósito desde:
//  - lib/brain/ingest/src/connectors/brainEntries.mjs (lectura de
//    brain_entries, título antepuesto, refuerzo de FAQ, salvaguarda
//    anti-mojibake D-009, marcado de indexed_at)
//  - lib/brain/ingest/src/ingest.mjs (borrado-e-inserción idempotente por
//    clave `entry_id` en metadata, lotes de inserción)
//
// Se vendoriza en vez de importarse porque el brain-service se construye con
// su propio contexto de build Docker (lib/brain/service/), separado del job
// batch (lib/brain/ingest/) -- mismo motivo y misma convención que
// sqlLiteral.mjs y chunking.mjs en este mismo directorio. Si el troceo, la
// query o la salvaguarda cambian en el connector original, replicar aquí
// también -- el resultado de indexar la MISMA entrada debe ser idéntico
// venga del job programado o del botón "indexar ahora".
//
// Invariantes que se mantienen SIN CAMBIOS respecto al connector original
// (no tocar sin releer docs/tecnico/revision-seguridad.md I3):
//  - `visibility` se hereda LITERALMENTE de cada brain_entries. Una entrada
//    'internal' nunca puede llegar a brain_documents como 'public' -- este
//    módulo no decide visibilidad, solo la copia tal cual viene de la fila.
//  - Salvaguarda D-009 (anti-mojibake): si el texto de entrada, o CUALQUIERA
//    de sus chunks, contiene U+FFFD (carácter de reemplazo) o el patrón de
//    doble codificación UTF-8 "Ã", esa entrada se descarta ENTERA -- no se
//    inserta ningún chunk suyo y NO se marca indexed_at (queda pendiente
//    para la próxima corrida). Se cuenta en `skipped`, nunca se cuela.
//  - indexed_at solo se marca DESPUÉS de insertar con éxito los chunks de esa
//    entrada concreta (nunca antes) -- así un fallo a medias dentro de una
//    entrada nunca queda marcado como "indexado".

import { pgQuery } from "./pgClient.mjs";
import { chunkMarkdown } from "./chunking.mjs";
import { embedBatch } from "./embeddings.mjs";
import { escapeStringLiteral, toVectorLiteral, toJsonbLiteral, toUuidLiteral } from "./sqlLiteral.mjs";
import { config } from "./config.mjs";

export const SOURCE = "conocimiento";

const FAQ_CATEGORY_SLUG = "preguntas-frecuentes";
const REPLACEMENT_CHAR = String.fromCharCode(0xfffd); // U+FFFD -- construido por código de punto, no como glifo literal, para no depender de la codificación con la que se guarde/edite este fichero.
const MOJIBAKE_CHAR = "Ã"; // U+00C3 -- huella de doble codificación UTF-8 (D-009)

function findCorruption(text) {
  if (text.includes(REPLACEMENT_CHAR)) {
    const idx = text.indexOf(REPLACEMENT_CHAR);
    return `carácter de reemplazo U+FFFD cerca de: "...${text.slice(Math.max(0, idx - 20), idx + 20)}..."`;
  }
  if (text.includes(MOJIBAKE_CHAR)) {
    const idx = text.indexOf(MOJIBAKE_CHAR);
    return `posible doble codificación UTF-8 (U+00C3 "Ã") cerca de: "...${text.slice(Math.max(0, idx - 20), idx + 20)}..."`;
  }
  return null;
}

/**
 * @param {{ all?: boolean }} opts  all=true reindexa TODAS las entradas
 *   (ignora indexed_at); por defecto solo las pendientes (indexed_at IS NULL).
 */
async function fetchBrainEntriesDocuments({ all = false } = {}) {
  const whereClause = all ? "" : "where e.indexed_at is null";
  const rows = await pgQuery(
    `select e.id, e.title, e.body, e.visibility, e.origin, e.category_id, e.area_id,\n` +
      `       bc.slug as category_slug, bc.name as category_name,\n` +
      `       c.name as area_name\n` +
      `from public.brain_entries e\n` +
      `join public.brain_categories bc on bc.id = e.category_id\n` +
      `left join public.categories c on c.id = e.area_id\n` +
      `${whereClause}\n` +
      `order by e.created_at;`
  );

  const documents = [];
  const skipped = [];

  for (const row of rows) {
    const isFaq = row.category_slug === FAQ_CATEGORY_SLUG;
    const reinforcement = isFaq ? `**Pregunta:** ${row.title}\n\n` : "";
    const fullText = `# ${row.title}\n\n${reinforcement}${row.body}`;

    const corruptionInSource = findCorruption(fullText);
    if (corruptionInSource) {
      skipped.push({ id: row.id, title: row.title, reason: corruptionInSource });
      console.warn(
        `⚠️  brain_entries ${row.id} ("${row.title}") SALTADA -- ${corruptionInSource}. ` +
          `No se indexa ni se marca indexed_at (ver D-009, docs/tecnico/decisiones-construccion.md).`
      );
      continue;
    }

    const chunks = chunkMarkdown(fullText, {
      targetChars: config.chunkTargetChars,
      overlapChars: config.chunkOverlapChars,
    });

    if (chunks.length === 0) {
      skipped.push({ id: row.id, title: row.title, reason: "0 chunks generados (cuerpo vacío tras trocear)" });
      console.warn(`⚠️  brain_entries ${row.id} ("${row.title}") SALTADA -- 0 chunks generados.`);
      continue;
    }

    // Segunda pasada de la salvaguarda, chunk a chunk -- defensa en
    // profundidad, no solo sobre el texto de entrada antes de trocear.
    const chunkCorruption = chunks.map((c) => findCorruption(c.text)).find(Boolean);
    if (chunkCorruption) {
      skipped.push({ id: row.id, title: row.title, reason: chunkCorruption });
      console.warn(
        `⚠️  brain_entries ${row.id} ("${row.title}") SALTADA -- corrupción detectada tras trocear: ${chunkCorruption}.`
      );
      continue;
    }

    documents.push({
      source: SOURCE,
      refId: row.id,
      visibility: row.visibility, // 'internal' | 'public' -- heredada literalmente de la entrada (I3)
      idempotencyKey: { entry_id: row.id },
      chunks: chunks.map((c, i) => ({
        text: c.text,
        metadata: {
          entry_id: row.id,
          title: row.title,
          category: row.category_slug,
          area: row.area_name || null,
          origin: row.origin,
          chunk_index: i,
          chunk_count: chunks.length,
        },
      })),
      onIndexed: async () => {
        await pgQuery(
          `update public.brain_entries set indexed_at = now() where id = ${toUuidLiteral(row.id)};`
        );
      },
    });
  }

  return { documents, skipped, totalEntries: rows.length };
}

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
 * Ejecuta la ingesta bajo demanda de brain_entries: fetch -> chunk -> embed
 * -> borrado-e-inserción idempotente -> marcar indexed_at. Misma mecánica que
 * lib/brain/ingest/src/ingest.mjs (ingestDocuments), reducida a un único
 * connector porque este servicio solo indexa la wiki (el resto del corpus
 * -- manifiesto, docs/ideario, artículos del blog -- lo indexa el job batch).
 *
 * Si pgQuery/embedBatch lanzan a mitad de la lista de documentos, el error
 * se propaga tal cual (mismo comportamiento que ingestDocuments): los
 * documentos ya procesados quedan correctamente indexados, el que falló no
 * queda marcado, y el llamador (server.mjs) lo traduce en una respuesta 502.
 *
 * @param {{ all?: boolean }} opts
 * @returns {Promise<{entriesIndexed: number, chunksInserted: number, skipped: number}>}
 */
export async function runWikiIngest({ all = false } = {}) {
  const { documents, skipped } = await fetchBrainEntriesDocuments({ all });

  let entriesIndexed = 0;
  let chunksInserted = 0;

  for (const doc of documents) {
    const whereClause = buildWhereClause(doc.source, doc.idempotencyKey);
    await pgQuery(`delete from brain_documents where ${whereClause};`);

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

    for (const batch of chunkArray(rows, config.insertBatchSize)) {
      await pgQuery(buildInsertSql(batch));
    }

    // Solo tras insertar con éxito TODOS los lotes de esta entrada.
    if (typeof doc.onIndexed === "function") {
      await doc.onIndexed();
    }

    entriesIndexed += 1;
    chunksInserted += rows.length;
  }

  return { entriesIndexed, chunksInserted, skipped: skipped.length };
}
