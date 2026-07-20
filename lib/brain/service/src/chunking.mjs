// lib/brain/service/src/chunking.mjs
//
// Copia deliberada de lib/brain/ingest/src/chunking.mjs (no se importa entre
// directorios: cada servicio se construye con Docker con su propio contexto
// de build, lib/brain/ingest/ y lib/brain/service/ respectivamente -- mismo
// motivo y misma convención que sqlLiteral.mjs, ver el comentario de cabecera
// de ese fichero). Necesaria aquí para /admin/ingest (ingestWiki.mjs), que
// debe trocear la wiki de conocimiento EXACTAMENTE igual que el job batch
// (lib/brain/ingest/src/connectors/brainEntries.mjs) -- si esta lógica
// divergiera entre los dos caminos, el mismo brain_entries produciría chunks
// distintos según se reindexe desde el job o desde el botón del panel admin.
// Si se cambia aquí, replicar en ingest/ y viceversa.
//
// Chunker sencillo consciente de Markdown: parte por encabezados (#, ##, ###),
// luego agrupa párrafos hasta un tamaño objetivo con solape, sin partir nunca
// un párrafo (ni una fila de tabla) a la mitad. Cada chunk lleva el/los
// encabezados de sección como prefijo de contexto -- mejora mucho la
// recuperación semántica de fragmentos cortos ("### Punto 17\n\n...").
//
// Deliberadamente no usa un parser de Markdown completo (remark/unified):
// para prosa relativamente simple (docs/ideario, docs/tecnico) una partición
// por líneas es suficiente y evita añadir dependencias a un job containerizado
// que debe ser mínimo y auditable.

function splitIntoParagraphs(text) {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Divide un documento Markdown en secciones por encabezado (# / ## / ###...).
 * Devuelve [{ headingPath: string[], body: string }]
 */
function splitByHeadings(markdown) {
  const lines = markdown.split("\n");
  const sections = [];
  let currentHeadingPath = [];
  let currentBody = [];

  function flush() {
    const body = currentBody.join("\n").trim();
    if (body) sections.push({ headingPath: [...currentHeadingPath], body });
    currentBody = [];
  }

  for (const line of lines) {
    const m = /^(#{1,6})\s+(.*)$/.exec(line);
    if (m) {
      flush();
      const level = m[1].length;
      const title = m[2].trim();
      currentHeadingPath = currentHeadingPath.slice(0, level - 1);
      currentHeadingPath[level - 1] = title;
    } else {
      currentBody.push(line);
    }
  }
  flush();
  return sections;
}

/**
 * Agrupa párrafos en chunks de hasta `targetChars`, con `overlapChars` de
 * solape entre chunks consecutivos (repite el final del chunk anterior al
 * principio del siguiente, para no perder contexto en el límite del corte).
 */
function packParagraphs(paragraphs, targetChars, overlapChars) {
  const chunks = [];
  let current = "";

  for (const para of paragraphs) {
    if (current && (current.length + 2 + para.length) > targetChars) {
      chunks.push(current);
      // Solape: toma el final del chunk que se acaba de cerrar.
      const overlap = current.slice(Math.max(0, current.length - overlapChars));
      current = overlap ? overlap + "\n\n" + para : para;
    } else {
      current = current ? current + "\n\n" + para : para;
    }
    // Párrafo enorme por sí solo (p.ej. una tabla larga): no lo partimos,
    // se deja como chunk propio aunque exceda el objetivo.
    if (current.length > targetChars * 2.5) {
      chunks.push(current);
      current = "";
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * @param {string} markdown contenido completo del documento
 * @param {object} opts { targetChars, overlapChars }
 * @returns {Array<{ text: string, heading: string|null }>}
 */
export function chunkMarkdown(markdown, opts = {}) {
  const targetChars = opts.targetChars ?? 1100;
  const overlapChars = opts.overlapChars ?? 150;

  const sections = splitByHeadings(markdown);
  const out = [];

  for (const section of sections) {
    const heading = section.headingPath.filter(Boolean).join(" > ") || null;
    const paragraphs = splitIntoParagraphs(section.body);
    if (paragraphs.length === 0) continue;
    const packed = packParagraphs(paragraphs, targetChars, overlapChars);
    for (const text of packed) {
      const prefixed = heading ? `${heading}\n\n${text}` : text;
      out.push({ text: prefixed, heading });
    }
  }
  return out;
}

/** Para textos cortos y ya atómicos (p.ej. un punto del manifiesto): un único
 *  chunk si cabe en el objetivo, o partido por párrafo si es más largo. */
export function chunkShortText(text, opts = {}) {
  const targetChars = opts.targetChars ?? 1100;
  if (text.length <= targetChars) return [{ text, heading: null }];
  const paragraphs = splitIntoParagraphs(text);
  return packParagraphs(paragraphs, targetChars, opts.overlapChars ?? 150).map((t) => ({
    text: t,
    heading: null,
  }));
}
