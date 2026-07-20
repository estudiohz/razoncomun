// lib/brain/ingest/src/connectors/corpusStorage.mjs
//
// Fuente: documentación en Markdown subida al bucket PRIVADO de Supabase
// Storage "corpus" (sustituye al bind mount original de rc-08 -- ver D-010 en
// docs/tecnico/decisiones-construccion.md: el bind mount exigía SSH que no
// estaba disponible, así que el corpus se subió a Storage). Reutiliza la
// MISMA credencial que ya usa este job para /pg/query (service_role) -- Kong
// enruta /storage/v1/* al servicio storage sin key-auth propio, la
// autorización la valida Storage contra el JWT (ver infra/supabase/volumes/api/kong.yml,
// servicio "storage-v1"), así que no hace falta ninguna variable nueva.
//
// Endpoints usados:
//   POST {SUPABASE_PUBLIC_URL}/storage/v1/object/list/corpus   {"prefix": "<carpeta>"}
//   GET  {SUPABASE_PUBLIC_URL}/storage/v1/object/corpus/<ruta>
//
// Carpetas del bucket -> visibilidad (mapeo fijado por el orquestador,
// distinto del que proponía la versión de bind mount de este agente):
//   ideario/*, marca/*, referencias/*  -> visibility='public'  (posición del
//                                          partido: debe poder citarse en el
//                                          chat público)
//   general/*                          -> visibility='internal' (visión de
//                                          producto / estrategia de captación:
//                                          útil para el cerebro interno, no
//                                          para el chat público)
//
// docs/tecnico/ NO está en el bucket (decisión del orquestador, D-010: el
// análisis de seguridad y los detalles operativos del VPS no se ingieren, ni
// como 'internal' -- riesgo asimétrico si algún día falla el filtro de
// visibilidad). Este conector, además, es explícito sobre qué carpetas
// reconoce: cualquier carpeta que no esté en FOLDER_VISIBILITY se IGNORA con
// un aviso, nunca se ingiere "por si acaso" -- defensa en profundidad para
// que esa decisión sobreviva aunque algún día aparezca algo inesperado en el
// bucket (p.ej. si alguien subiera "tecnico/" por error).
//
// Codificación (lección de D-009 -- doble codificación UTF-8 en los seeds,
// que llegó a corromper el 93% de brain_documents antes de detectarse):
// el cuerpo de cada objeto se lee como bytes (`arrayBuffer()`) y se decodifica
// EXPLÍCITAMENTE como UTF-8 con `TextDecoder({fatal:true})` -- nunca se deja
// que un decodificador adivine ni se usa `res.text()` a ciegas. Además, tras
// decodificar, se escanea el resultado en busca de U+00C3 ("Ã"): esa letra no
// existe en español, así que su presencia es la huella casi inequívoca de un
// texto que ya venía mal codificado antes de llegar aquí. Si aparece, el
// documento se rechaza con un error claro en vez de indexar silenciosamente
// un chunk corrupto (justo el tipo de fallo que describe D-009: "nada falla
// de forma visible").

import { chunkMarkdown } from "../chunking.mjs";
import { config } from "../config.mjs";

export const SOURCE = "estudio";

const FOLDER_VISIBILITY = {
  ideario: "public",
  marca: "public",
  referencias: "public",
  general: "internal",
};

const MOJIBAKE_CHAR = "Ã"; // "Ã" -- no existe en español; ver nota de arriba

function assertNoMojibake(text, fileKey) {
  if (text.includes(MOJIBAKE_CHAR)) {
    const idx = text.indexOf(MOJIBAKE_CHAR);
    const around = text.slice(Math.max(0, idx - 20), idx + 20);
    throw new Error(
      `Posible doble codificación UTF-8 (U+00C3 "Ã") en "${fileKey}" cerca de: "...${around}...". ` +
        `Rechazado -- ver D-009 en docs/tecnico/decisiones-construccion.md. No se ingiere texto sospechoso de mojibake.`
    );
  }
}

async function storageRequest(path, { method = "GET", body } = {}) {
  const url = `${config.supabaseUrl}/storage/v1${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Storage ${method} ${path} -> HTTP ${res.status}: ${errText.slice(0, 300)}`);
  }
  return res;
}

async function listFolder(prefix) {
  const res = await storageRequest(`/object/list/${config.corpusStorageBucket}`, { method: "POST", body: { prefix } });
  const entries = await res.json();
  // La API de Storage devuelve tanto ficheros como "carpetas" (id === null y
  // sin metadata) cuando se lista la raíz -- nos quedamos solo con objetos
  // reales (tienen metadata.size) y con extensión .md.
  return entries
    .filter((e) => e.metadata && typeof e.metadata.size === "number")
    .filter((e) => e.name.toLowerCase().endsWith(".md"))
    .map((e) => ({ name: e.name, size: e.metadata.size }));
}

async function downloadFile(path) {
  const res = await storageRequest(`/object/${config.corpusStorageBucket}/${path}`);
  const buf = await res.arrayBuffer();
  // Decodificación EXPLÍCITA de UTF-8, con `fatal:true`: si hubiera bytes que
  // no forman una secuencia UTF-8 válida, esto lanza en vez de sustituir
  // silenciosamente por U+FFFD (el error que ya hizo irreparable la tabla
  // `territories` en D-009).
  const decoder = new TextDecoder("utf-8", { fatal: true });
  return decoder.decode(buf);
}

export async function fetchCorpusStorageDocuments() {
  const docs = [];
  const mojibakeScan = { filesChecked: 0, found: [] };

  for (const [folder, visibility] of Object.entries(FOLDER_VISIBILITY)) {
    let files;
    try {
      files = await listFolder(folder);
    } catch (err) {
      throw new Error(`No se pudo listar la carpeta "${folder}" del bucket "corpus": ${err.message}`);
    }

    for (const file of files) {
      const fileKey = `${folder}/${file.name}`;
      const text = await downloadFile(fileKey);

      mojibakeScan.filesChecked += 1;
      if (text.includes(MOJIBAKE_CHAR)) mojibakeScan.found.push(fileKey);
      assertNoMojibake(text, fileKey); // aborta la ingesta entera -- mejor fallar alto y claro

      const chunks = chunkMarkdown(text, {
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
            area: folder,
            heading: c.heading,
            chunk_index: i,
            chunk_count: chunks.length,
            byte_size: file.size,
          },
        })),
      });
    }
  }

  // Aviso (no error) si el bucket contiene carpetas que este conector no
  // reconoce -- p.ej. si algún día apareciera "tecnico/", NO se ingiere, pero
  // sí se avisa fuerte para que alguien lo note y lo borre del bucket.
  // listFolder() filtra a solo ficheros .md con metadata.size, así que las
  // "carpetas" (entradas sin metadata) se listan aparte, en crudo.
  const rawRootRes = await storageRequest(`/object/list/${config.corpusStorageBucket}`, { method: "POST", body: { prefix: "" } });
  const rawRoot = await rawRootRes.json();
  const unknownFolders = rawRoot
    .map((e) => e.name)
    .filter((name) => !(name in FOLDER_VISIBILITY));
  if (unknownFolders.length > 0) {
    console.warn(
      `⚠️  Carpetas del bucket "corpus" NO reconocidas por este conector (IGNORADAS, no ingeridas): ${unknownFolders.join(
        ", "
      )}. Si una de ellas es "tecnico", es la decisión correcta -- ver D-010.`
    );
  }

  return { docs, mojibakeScan, unknownFolders };
}
