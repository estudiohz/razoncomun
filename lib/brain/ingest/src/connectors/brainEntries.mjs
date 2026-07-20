// lib/brain/ingest/src/connectors/brainEntries.mjs
//
// Fuente: public.brain_entries (0024_brain_wiki.sql) -- la wiki de conocimiento
// AUTORADA por el equipo humano (admin/editor), no un volcado automático de otra
// tabla. Cita literal de Sergio en la migración 0024: "No vamos a publicar
// documentos. Vamos a subir información como si fueran artículos. Los
// administradores irán alimentando el cerebro."
//
// Relación con brain_documents (0012, esquema de rc-02, no se toca): esta es
// la capa de CHUNK+EMBEDDING. Este connector vuelca cada brain_entries en sus
// chunks con source='conocimiento' (valor añadido al CHECK por la propia
// migración 0024) y ref_id = brain_entries.id.
//
// Reindexado incremental: por defecto solo se procesan las entradas con
// indexed_at IS NULL (pendientes -- el trigger brain_entries_reset_indexed_at
// las pone a NULL cuando cambia `body` o `visibility`). fetchBrainEntriesDocuments
// ({ all: true }) fuerza un reindexado completo (todas las entradas, hayan
// cambiado o no) -- útil tras cambiar la config de chunking/embeddings, o para
// una primera carga masiva.
//
// Título SIEMPRE antepuesto (pieza decisiva de este connector, pedida
// explícitamente para que preguntas ciudadanas como "¿qué cuota de autónomos
// vais a cobrar?" se recuperen bien): el texto que se trocea es
// "# {title}\n\n{body}". chunkMarkdown() trata "# {title}" como un
// encabezado de nivel 1 y antepone ese heading a CADA chunk resultante de la
// sección (ver chunking.mjs, packParagraphs/splitByHeadings) -- así el título
// queda presente en TODOS los chunks de la entrada, no solo en el primero,
// aunque la respuesta se trocee en varios fragmentos.
//
// Refuerzo para "Preguntas frecuentes": si brain_categories.slug es
// 'preguntas-frecuentes', el título (la pregunta literal del ciudadano) se
// repite una segunda vez justo debajo del heading, como "**Pregunta:** ...".
// Es una duplicación deliberada de las mismas palabras clave -- más señal
// para la similitud coseno cuando alguien pregunta con una redacción parecida
// a la pregunta original.
//
// Salvaguarda anti-mojibake/corrupción (lección D-009, misma idea que
// corpusStorage.mjs): se escanea el texto de CADA chunk en busca de U+FFFD
// (carácter de reemplazo -- señal de bytes que no se pudieron decodificar) y
// de U+00C3 "Ã" (huella de una doble codificación UTF-8; esa letra no existe
// en español). A diferencia de corpusStorage.mjs (que aborta la ingesta
// ENTERA si aparece), aquí el fallo es por ENTRADA: se descarta solo la
// entrada afectada, se registra un aviso claro, y NO se marca indexed_at
// (queda pendiente para la próxima corrida) -- así una entrada con contenido
// roto no bloquea reindexar el resto de la wiki.

import { pgQuery } from "../pgClient.mjs";
import { chunkMarkdown } from "../chunking.mjs";
import { toUuidLiteral } from "../sqlLiteral.mjs";
import { config } from "../config.mjs";

export const SOURCE = "conocimiento";

const FAQ_CATEGORY_SLUG = "preguntas-frecuentes";
const REPLACEMENT_CHAR = String.fromCharCode(0xfffd); // U+FFFD -- bytes que no se pudieron decodificar. Construido por código de punto (no como glifo literal en el fichero fuente) para no depender de la codificación con la que se guarde/edite este propio fichero.
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
 * @returns {Promise<{ documents: object[], skipped: object[], totalEntries: number }>}
 */
export async function fetchBrainEntriesDocuments({ all = false } = {}) {
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
      // buildWhereClause (ingest.mjs) convierte esto en:
      //   source = 'conocimiento' and metadata->>'entry_id' = '<uuid>'
      // -- equivalente en efecto a `ref_id = '<uuid>'` (ambos identifican SOLO
      // los chunks de esta entrada, y entry_id en metadata coincide siempre
      // con ref_id porque los fija este mismo bloque), reutilizando el
      // mecanismo genérico de borrado-e-inserción que ya usan manifesto.mjs y
      // corpusStorage.mjs en vez de añadir una rama nueva a ingest.mjs.
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
      // Se ejecuta SOLO tras insertar con éxito los chunks de esta entrada
      // (ver ingest.mjs: se llama después del INSERT, nunca antes) -- así
      // indexed_at nunca queda en `now()` si el INSERT falló a medias.
      onIndexed: async () => {
        await pgQuery(
          `update public.brain_entries set indexed_at = now() where id = ${toUuidLiteral(row.id)};`
        );
      },
    });
  }

  return { documents, skipped, totalEntries: rows.length };
}
