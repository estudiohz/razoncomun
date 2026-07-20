// lib/brain/ingest/src/connectors/corpusDocs.mjs
//
// Fuente: documentación en Markdown (docs/ideario, docs/marca, docs/tecnico)
// montada como bind mount de solo lectura en el contenedor -- ver README
// "Corpus de documentos: por qué NO vive en este repo público" para el
// razonamiento completo. Estructura esperada:
//
//   {corpusPublicDir}/**/*.md    -> visibility='public'  (ideario, marca:
//                                    es la filosofía y la identidad del
//                                    partido, coherente con "prohibido el
//                                    silencio estratégico", punto 25)
//   {corpusInternalDir}/**/*.md  -> visibility='internal' (docs/tecnico:
//                                    arquitectura, seguridad, decisiones de
//                                    infraestructura -- solo para el bot de
//                                    equipo en Discord, nunca para el chat
//                                    público)
//
// Mapeo de `source`: el CHECK constraint de brain_documents (propiedad de
// rc-02-datos, no se toca) solo admite:
//   manifiesto | estatutos | blog | decision | opinion | video | estudio
// Ninguno encaja con precisión para "documentación interna del proyecto".
// Se usa 'estudio' como cajón menos incorrecto (ver rc-brain.md: ya lo
// describe como corpus de "informes"/referencia), y se guarda el área real
// en metadata.area para no perder la distinción. Señalado en el informe como
// candidato a que rc-02 añada un valor más preciso al CHECK en una futura
// migración (no bloqueante).

import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, extname } from "node:path";
import { chunkMarkdown } from "../chunking.mjs";
import { config } from "../config.mjs";

export const SOURCE = "estudio";

async function walkMarkdownFiles(rootDir) {
  const found = [];
  async function walk(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (err) {
      if (err.code === "ENOENT") return; // directorio no montado -- se ignora, no es error fatal
      throw err;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && extname(entry.name).toLowerCase() === ".md") {
        found.push(full);
      }
    }
  }
  await walk(rootDir);
  return found;
}

async function loadDocsFrom(rootDir, visibility) {
  const files = await walkMarkdownFiles(rootDir);
  const docs = [];
  for (const filePath of files) {
    const raw = await readFile(filePath, "utf8");
    // relPath conserva la subcarpeta real (p.ej. "ideario/principios.md",
    // "tecnico/rc-brain.md") -- de ahí sacamos el área temática, no de la
    // visibilidad (que es un eje distinto).
    const relPath = relative(rootDir, filePath).replace(/\\/g, "/");
    const area = relPath.split("/")[0] || "raiz";
    const fileKey = `${visibility}/${relPath}`;
    const st = await stat(filePath);

    const chunks = chunkMarkdown(raw, {
      targetChars: config.chunkTargetChars,
      overlapChars: config.chunkOverlapChars,
    });

    if (chunks.length === 0) continue;

    docs.push({
      source: SOURCE,
      refId: null,
      visibility,
      idempotencyKey: { file: fileKey },
      chunks: chunks.map((c, i) => ({
        text: c.text,
        metadata: {
          file: fileKey,
          area,
          heading: c.heading,
          chunk_index: i,
          chunk_count: chunks.length,
          mtime: st.mtime.toISOString(),
        },
      })),
    });
  }
  return docs;
}

export async function fetchCorpusDocDocuments() {
  const publicDocs = await loadDocsFrom(config.corpusPublicDir, "public");
  const internalDocs = await loadDocsFrom(config.corpusInternalDir, "internal");
  return [...publicDocs, ...internalDocs];
}
