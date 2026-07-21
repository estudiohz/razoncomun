#!/usr/bin/env node
// lib/brain/service/src/server.mjs
//
// rc-brain-service: el servicio persistente (Node, http nativo, cero
// dependencias -- misma convención que lib/brain/ingest) que concentra RAG +
// constitución + generación + logging. La web (proxy fino en
// apps/web/src/app/api/chat, /api/opina) y el bot de Discord hablan con este
// servicio por HTTP; ninguno de los dos toca Postgres/Ollama/Anthropic
// directamente -- así el filtro de visibilidad (I3) y el guardrail
// anti-inyección (I4) viven en UN SITIO, no duplicados en cada canal.
//
// Endpoints:
//   GET  /health                     -- sin auth, para healthcheck de Docker/Dokploy
//   POST /chat                       -- PÚBLICO. RAG estricto, SOLO visibility='public'.
//   POST /chat-team                  -- INTERNO (Bearer BRAIN_INTERNAL_TOKEN). Corpus completo.
//   POST /opina/turn                 -- PÚBLICO. Entrevistador de Opina (chatbot-opina.md).
//   POST /classify-opinion           -- INTERNO. Clasifica+guarda un comentario (Telegram/Discord/n8n).
//   POST /neutrality-suite/run       -- INTERNO. Corre la suite de 16 pares y escribe en ai_evals.
//   POST /admin/ingest               -- SERVIDOR-A-SERVIDOR (X-Ingest-Secret). Indexa
//                                        bajo demanda la wiki de conocimiento (brain_entries).
//
// Fail-closed: sin BRAIN_INTERNAL_TOKEN configurado, las rutas internas
// devuelven 501 (no 200 "vacío") -- nunca fail-open. /admin/ingest usa su
// propio secreto (INGEST_TRIGGER_SECRET) y es aún más estricto: sin
// configurar, o con secreto incorrecto, responde 401 SIEMPRE con el mismo
// mensaje genérico -- nunca 501 ni ningún detalle que revele si el env
// existe (ver requireIngestSecret más abajo).

import http from "node:http";
import crypto from "node:crypto";
import { config } from "./config.mjs";
import { retrieve, bestSimilarity } from "./retrieval.mjs";
import { pgQuery } from "./pgClient.mjs";
import { escapeStringLiteral } from "./sqlLiteral.mjs";
import { detectInjection, REFUSAL_MESSAGE } from "./injectionGuard.mjs";
import {
  buildPublicChatSystemPrompt,
  buildTeamChatSystemPrompt,
  buildUserTurn,
  describeSource,
  OUT_OF_CORPUS_MESSAGE,
} from "./constitution.mjs";
import { generate, AnthropicNotConfiguredError } from "./llm.mjs";
import { getActiveProviderConfig, ENV_FALLBACK_CREDENTIAL_ID } from "./credentialStore.mjs";
import { startProviderWatch, checkAndRevertIfUnsafe } from "./providerWatcher.mjs";
import { logChatTurn, sessionUuid } from "./audit.mjs";
import { checkIpAndSession, startCleanup } from "./rateLimit.mjs";
import { classifyAndStoreOpinion } from "./opinions.mjs";
import { runNeutralitySuite } from "./neutralitySuite.mjs";
import { runOpinaTurn } from "./opinaFlow.mjs";
import { runWikiIngest } from "./ingestWiki.mjs";

const MAX_BODY_BYTES = 8 * 1024; // un mensaje de chat no necesita más
const MAX_MESSAGE_CHARS = 2000;

function ipHash(ip) {
  const salt = process.env.BRAIN_IP_HASH_SALT || "rc-brain-default-salt-cambiar-en-produccion";
  return crypto.createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

function clientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) return xff.split(",")[0].trim();
  return req.socket.remoteAddress || "desconocida";
}

function sendJson(res, status, obj) {
  const body = Buffer.from(JSON.stringify(obj), "utf-8");
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": body.length,
    // El chat es un widget embebido en la web pública -- CORS abierto a
    // GET/POST de este único endpoint, sin cookies/credenciales (no hay
    // sesión de auth involucrada, sessionId lo genera el cliente).
    "Access-Control-Allow-Origin": process.env.CORS_ALLOW_ORIGIN || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("Cuerpo de la petición demasiado grande."), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (chunks.length === 0) return resolve({});
      // Se acumulan los Buffers CRUDOS y solo se decodifica UNA VEZ al final
      // (nunca chunk a chunk ni con `data += chunk`) -- así un carácter
      // multibyte (tildes, ñ, €...) partido entre dos paquetes TCP siempre
      // se reensambla antes de decodificar. Ver bug D-009 (pgClient.mjs).
      const raw = Buffer.concat(chunks).toString("utf-8");
      // Guardrail adicional: si pese a esto el body trae bytes que NO son
      // UTF-8 válido (p.ej. un cliente que codificó mal antes de enviar),
      // Node los sustituye por U+FFFD de forma silenciosa e IRREVERSIBLE --
      // el carácter original ya no es recuperable en este punto. Como
      // audit_log es append-only (no se puede corregir después), se rechaza
      // la petición entera aquí, ANTES del insert, en vez de dejar pasar
      // mojibake para siempre. Así ninguna fila nueva puede entrar corrupta,
      // sea cual sea el canal o el origen del fallo de codificación.
      if (raw.includes("�")) {
        reject(
          Object.assign(
            new Error(
              "El cuerpo de la petición contiene bytes que no son UTF-8 válido (se han perdido caracteres en el camino). Reenvía con Content-Type: application/json; charset=utf-8 y el texto codificado en UTF-8."
            ),
            { statusCode: 400 }
          )
        );
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(Object.assign(new Error("JSON inválido."), { statusCode: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function requireInternalAuth(req) {
  if (!config.internalToken) return { ok: false, status: 501, error: "BRAIN_INTERNAL_TOKEN no configurado en el servicio (fail-closed, pendiente de Sergio)." };
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (token !== config.internalToken) return { ok: false, status: 401, error: "No autorizado." };
  return { ok: true };
}

// Comparación a tiempo constante para el secreto de /admin/ingest -- este
// endpoint dispara trabajo con coste real (embeddings), así que un atacante
// que descubra la ruta no debe poder ni deducir el secreto byte a byte por
// diferencias de tiempo de respuesta, ni distinguir "secreto mal configurado
// en el servicio" de "secreto incorrecto" (mismo status, mismo mensaje en
// ambos casos, ver requireIngestSecret).
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a), "utf-8");
  const bufB = Buffer.from(String(b), "utf-8");
  if (bufA.length !== bufB.length) {
    // Se compara igualmente (contra sí mismo) para no filtrar por timing que
    // la longitud no coincidía; el resultado real es descartado a propósito.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

// /admin/ingest -- SERVIDOR-A-SERVIDOR, nunca público. Sin
// INGEST_TRIGGER_SECRET configurado, o con un valor que no coincide con la
// cabecera X-Ingest-Secret, se responde 401 sin más detalle: no hay ruta para
// disparar la ingesta (y su coste de embeddings) sin el secreto correcto.
function requireIngestSecret(req) {
  const configured = config.ingestTriggerSecret;
  if (!configured) return { ok: false, status: 401, error: "No autorizado." };
  const header = req.headers["x-ingest-secret"];
  if (typeof header !== "string" || header.length === 0 || !safeEqual(header, configured)) {
    return { ok: false, status: 401, error: "No autorizado." };
  }
  return { ok: true };
}

function normalizeMessage(raw) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_MESSAGE_CHARS);
}

// ---------------------------------------------------------------------------
// /chat -- canal PÚBLICO. visibility SIEMPRE 'public', hardcodeado aquí; NO
// se lee de ningún campo del body (aunque el cliente mande visibility:
// "internal" en el JSON, se ignora por completo -- ver retrieval.mjs).
// ---------------------------------------------------------------------------
async function handlePublicChat(req, res, body) {
  const ip = clientIp(req);
  const sessionId = String(body.sessionId || "sin-sesion").slice(0, 200);
  const message = normalizeMessage(body.message);

  if (!message) return sendJson(res, 400, { error: "Falta 'message' (texto no vacío)." });

  const rl = checkIpAndSession(ip, sessionId, {
    perIp: config.rateLimitPerIpPerHour,
    perSession: config.rateLimitPerSessionPerHour,
  });
  if (!rl.allowed) {
    return sendJson(res, 429, {
      error: `Límite de uso alcanzado (${rl.scope}). Vuelve a intentarlo más tarde.`,
      retryAfterMs: rl.retryAfterMs,
    });
  }

  const injection = detectInjection(message);
  if (injection.flagged) {
    await logChatTurn({
      channel: "web",
      sessionId,
      ipHash: ipHash(ip),
      userText: message,
      answerText: REFUSAL_MESSAGE,
      sources: [],
      outOfCorpus: false,
      flaggedInjection: true,
    }).catch((err) => console.error("[audit] fallo registrando turno (injection):", err.message));
    return sendJson(res, 200, {
      answer: REFUSAL_MESSAGE,
      sources: [],
      outOfCorpus: false,
      flaggedInjection: true,
    });
  }

  // SIEMPRE 'public' -- este es el único valor permitido en este endpoint.
  const rows = await retrieve(message, { visibility: "public" });
  const similarity = bestSimilarity(rows);
  const outOfCorpus = rows.length === 0 || similarity < config.outOfCorpusThreshold;

  if (outOfCorpus) {
    await logChatTurn({
      channel: "web",
      sessionId,
      ipHash: ipHash(ip),
      userText: message,
      answerText: OUT_OF_CORPUS_MESSAGE,
      sources: [],
      outOfCorpus: true,
      flaggedInjection: false,
    }).catch((err) => console.error("[audit] fallo registrando turno (fuera de corpus):", err.message));
    return sendJson(res, 200, { answer: OUT_OF_CORPUS_MESSAGE, sources: [], outOfCorpus: true, flaggedInjection: false });
  }

  const sources = rows.map((r) => ({ label: describeSource(r), source: r.source, similarity: Number(r.similarity) }));
  const charts = await chartsForRows(rows);
  let answer;
  try {
    answer = await generate({
      system: buildPublicChatSystemPrompt(),
      userTurn: buildUserTurn({ contextChunks: rows, userText: message }),
    });
  } catch (err) {
    if (err instanceof AnthropicNotConfiguredError) {
      return sendJson(res, 503, {
        error: "La generación de respuestas está pendiente de configuración (ANTHROPIC_API_KEY). La recuperación de fuentes SÍ funciona:",
        sources,
        outOfCorpus: false,
      });
    }
    console.error("[chat] error generando respuesta:", err.message);
    return sendJson(res, 502, { error: "Error generando la respuesta. Inténtalo de nuevo en unos segundos." });
  }

  // Refuerzo de la regla 3 (citar fuentes SIEMPRE, no solo si el modelo se
  // acuerda): se añade la lista de fuentes recuperadas al final, siempre.
  const fuentesTexto = sources.map((s, i) => `[${i + 1}] ${s.label}`).join("\n");
  const answerWithSources = `${answer.trim()}\n\nFuentes:\n${fuentesTexto}`;

  await logChatTurn({
    channel: "web",
    sessionId,
    ipHash: ipHash(ip),
    userText: message,
    answerText: answerWithSources,
    sources,
    outOfCorpus: false,
    flaggedInjection: false,
  }).catch((err) => console.error("[audit] fallo registrando turno:", err.message));

  return sendJson(res, 200, { answer: answerWithSources, sources, outOfCorpus: false, flaggedInjection: false, charts });
}

/**
 * Gráficos/tablas adjuntos a las entradas de la wiki recuperadas (0026). Solo
 * para chunks de source='conocimiento' (los que enlazan a brain_entries por
 * ref_id). Los datos son de AUTORÍA HUMANA: se devuelven verbatim para que el
 * front los pinte, la IA nunca los toca ni los inventa. Se preserva el orden de
 * similitud (mejores primero) y se limita a unos pocos para no saturar. Fallo
 * de lectura => se degrada a sin gráficos, nunca tumba la respuesta del chat.
 */
async function chartsForRows(rows) {
  const orderedIds = [];
  for (const r of rows) {
    if (r.source === "conocimiento" && r.ref_id && !orderedIds.includes(r.ref_id)) {
      orderedIds.push(r.ref_id);
    }
  }
  if (orderedIds.length === 0) return [];

  const inList = orderedIds.map((id) => escapeStringLiteral(id)).join(",");
  let entryRows;
  try {
    entryRows = await pgQuery(
      `select id, charts from brain_entries where visibility = 'public' and id in (${inList});`
    );
  } catch (err) {
    console.error("[chat] fallo leyendo charts de brain_entries:", err.message);
    return [];
  }

  const byId = new Map(
    entryRows.map((e) => {
      let cs = e.charts;
      if (typeof cs === "string") {
        try {
          cs = JSON.parse(cs);
        } catch {
          cs = [];
        }
      }
      return [e.id, Array.isArray(cs) ? cs : []];
    })
  );

  const out = [];
  for (const id of orderedIds) {
    for (const c of byId.get(id) ?? []) {
      if (c && Array.isArray(c.data) && c.data.length > 0) out.push(c);
    }
  }
  return out.slice(0, 4);
}

// ---------------------------------------------------------------------------
// /chat-team -- canal INTERNO (Discord del equipo). visibility: null =
// corpus completo (público + interno). Requiere BRAIN_INTERNAL_TOKEN.
// ---------------------------------------------------------------------------
async function handleTeamChat(req, res, body) {
  const auth = requireInternalAuth(req);
  if (!auth.ok) return sendJson(res, auth.status, { error: auth.error });

  const sessionId = String(body.sessionId || "discord-sin-sesion").slice(0, 200);
  const message = normalizeMessage(body.message);
  if (!message) return sendJson(res, 400, { error: "Falta 'message' (texto no vacío)." });

  const injection = detectInjection(message);
  if (injection.flagged) {
    await logChatTurn({
      channel: "discord",
      sessionId,
      ipHash: null,
      userText: message,
      answerText: REFUSAL_MESSAGE,
      sources: [],
      outOfCorpus: false,
      flaggedInjection: true,
    }).catch(() => {});
    return sendJson(res, 200, { answer: REFUSAL_MESSAGE, sources: [], flaggedInjection: true });
  }

  const rows = await retrieve(message, { visibility: null });
  const sources = rows.map((r) => ({ label: describeSource(r), source: r.source, visibility: r.visibility }));

  let answer;
  try {
    answer = await generate({
      system: buildTeamChatSystemPrompt(),
      userTurn: buildUserTurn({ contextChunks: rows, userText: message }),
    });
  } catch (err) {
    if (err instanceof AnthropicNotConfiguredError) {
      return sendJson(res, 503, { error: "ANTHROPIC_API_KEY pendiente de configurar.", sources });
    }
    return sendJson(res, 502, { error: `Error generando respuesta: ${err.message}` });
  }

  await logChatTurn({
    channel: "discord",
    sessionId,
    ipHash: null,
    userText: message,
    answerText: answer,
    sources,
    outOfCorpus: rows.length === 0,
    flaggedInjection: false,
  }).catch(() => {});

  return sendJson(res, 200, { answer, sources, flaggedInjection: false });
}

// ---------------------------------------------------------------------------
// /opina/turn -- entrevistador de Opina (chatbot-opina.md). PÚBLICO.
// ---------------------------------------------------------------------------
async function handleOpinaTurn(req, res, body) {
  const ip = clientIp(req);
  const sessionId = String(body.sessionId || "sin-sesion").slice(0, 200);
  const rl = checkIpAndSession(ip, sessionId, {
    perIp: config.rateLimitPerIpPerHour,
    perSession: config.rateLimitPerSessionPerHour,
  });
  if (!rl.allowed) {
    return sendJson(res, 429, { error: `Límite de uso alcanzado (${rl.scope}).`, retryAfterMs: rl.retryAfterMs });
  }

  const message = normalizeMessage(body.message);
  const history = Array.isArray(body.history) ? body.history.slice(-10) : [];
  const channel = body.channel === "discord" || body.channel === "telegram" ? body.channel : "web";

  if (message) {
    const injection = detectInjection(message);
    if (injection.flagged) {
      return sendJson(res, 200, {
        reply: REFUSAL_MESSAGE,
        done: false,
        history: [...history, { role: "user", text: message }, { role: "assistant", text: REFUSAL_MESSAGE }],
      });
    }
  }

  try {
    const result = await runOpinaTurn({ message, history, channel, segment: body.segment || null, userId: body.userId || null });
    await logChatTurn({
      channel: `opina-${channel}`,
      sessionId,
      ipHash: ipHash(ip),
      userText: message || "(apertura)",
      answerText: result.reply,
      sources: [],
      outOfCorpus: false,
      flaggedInjection: false,
    }).catch(() => {});
    return sendJson(res, 200, result);
  } catch (err) {
    if (err instanceof AnthropicNotConfiguredError) {
      // Degradación explícita, NUNCA un 502 confuso al ciudadano que está
      // cerrando su opinión: sin ANTHROPIC_API_KEY no podemos clasificar (ni
      // por tanto guardar en `opinions`, cuyo esquema exige stance/kind/quality
      // ya validados), pero se lo decimos con claridad y sin perder su texto
      // (queda en audit_log vía logChatTurn de arriba -- este catch corre
      // DESPUÉS de que runOpinaTurn falle, así que hay que registrar aquí).
      const pendingMsg =
        "Gracias por contarlo -- de momento no puedo clasificar y guardar tu opinión porque la conexión con el clasificador está pendiente de configurar en el partido. Tu texto no se ha perdido, pero por favor inténtalo de nuevo más tarde o compártelo también en nuestro Discord.";
      await logChatTurn({
        channel: `opina-${channel}`,
        sessionId,
        ipHash: ipHash(ip),
        userText: message || "(apertura)",
        answerText: pendingMsg,
        sources: [],
        outOfCorpus: false,
        flaggedInjection: false,
      }).catch(() => {});
      return sendJson(res, 200, { reply: pendingMsg, done: false, pendingConfig: true });
    }
    console.error("[opina] error:", err.message);
    return sendJson(res, 502, { error: `Error en el flujo de Opina: ${err.message}` });
  }
}

// ---------------------------------------------------------------------------
// /classify-opinion -- INTERNO. Uso: n8n (Telegram/Discord), backfill.
// ---------------------------------------------------------------------------
async function handleClassifyOpinion(req, res, body) {
  const auth = requireInternalAuth(req);
  if (!auth.ok) return sendJson(res, auth.status, { error: auth.error });

  const rawText = normalizeMessage(body.rawText);
  if (!rawText) return sendJson(res, 400, { error: "Falta 'rawText'." });
  const channel = body.channel || "web";

  try {
    const row = await classifyAndStoreOpinion({
      rawText,
      channel,
      segment: body.segment || null,
      userId: body.userId || null,
    });
    return sendJson(res, 200, { ok: true, opinion: row });
  } catch (err) {
    return sendJson(res, 502, { error: err.message });
  }
}

// ---------------------------------------------------------------------------
// /neutrality-suite/run -- INTERNO. Corre los 16 pares y escribe en ai_evals.
// ---------------------------------------------------------------------------
async function handleNeutralitySuite(req, res) {
  const auth = requireInternalAuth(req);
  if (!auth.ok) return sendJson(res, auth.status, { error: auth.error });
  try {
    const summary = await runNeutralitySuite();
    return sendJson(res, 200, summary);
  } catch (err) {
    return sendJson(res, 502, { error: err.message });
  }
}

// ---------------------------------------------------------------------------
// /provider/verify -- INTERNO (D-016). Dispara a demanda la comprobación que
// providerWatcher.mjs también corre solo periódicamente: suite de
// neutralidad + revert automático si cae por debajo del umbral. Pensado para
// que el panel admin (rc-wt-ajustes) pida feedback inmediato tras cambiar de
// proveedor, en vez de esperar al siguiente ciclo del vigilante -- y es lo
// que usa el gate de esta ola para demostrar la reversión sin depender de un
// temporizador en segundo plano.
// ---------------------------------------------------------------------------
async function handleProviderVerify(req, res) {
  const auth = requireInternalAuth(req);
  if (!auth.ok) return sendJson(res, auth.status, { error: auth.error });
  try {
    const result = await checkAndRevertIfUnsafe({ force: true });
    return sendJson(res, 200, result);
  } catch (err) {
    return sendJson(res, 502, { error: err.message });
  }
}

// ---------------------------------------------------------------------------
// /admin/ingest -- SERVIDOR-A-SERVIDOR (X-Ingest-Secret). Indexa bajo demanda
// la wiki de conocimiento (brain_entries -> brain_documents, ver
// ingestWiki.mjs). NO pasa por el rate-limit del chat (no es un canal de
// usuario final) -- su única puerta es el secreto.
// ---------------------------------------------------------------------------
async function handleAdminIngest(req, res, body) {
  const auth = requireIngestSecret(req);
  if (!auth.ok) return sendJson(res, auth.status, { ok: false, error: auth.error });

  let mode = "pending";
  if (body && body.mode !== undefined) {
    if (body.mode !== "pending" && body.mode !== "all") {
      return sendJson(res, 400, { ok: false, error: "'mode' debe ser 'pending' o 'all'." });
    }
    mode = body.mode;
  }

  try {
    const summary = await runWikiIngest({ all: mode === "all" });
    return sendJson(res, 200, {
      ok: true,
      entries_indexed: summary.entriesIndexed,
      chunks_inserted: summary.chunksInserted,
      skipped: summary.skipped,
    });
  } catch (err) {
    console.error("[admin/ingest] error:", err.message);
    return sendJson(res, 502, { ok: false, error: err.message });
  }
}

const routes = {
  "POST /chat": handlePublicChat,
  "POST /chat-team": handleTeamChat,
  "POST /opina/turn": handleOpinaTurn,
  "POST /classify-opinion": handleClassifyOpinion,
  "POST /provider/verify": handleProviderVerify,
  "POST /admin/ingest": handleAdminIngest,
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "OPTIONS") {
    return sendJson(res, 204, {});
  }

  if (req.method === "GET" && url.pathname === "/health") {
    // activeProvider: nunca incluye la clave, solo qué proveedor/modelo está
    // activo y de dónde vino (fila de BD vs fallback de entorno) -- útil
    // para confirmar desde fuera que un cambio hecho en el panel ya surtió
    // efecto, sin exponer ningún secreto por este endpoint sin auth.
    let activeProvider = { configured: false, source: "ninguno" };
    try {
      const cred = await getActiveProviderConfig();
      activeProvider = {
        configured: true,
        provider: cred.provider,
        model: cred.model,
        source: cred.credentialId === ENV_FALLBACK_CREDENTIAL_ID ? "env-fallback" : "db",
      };
    } catch {
      // sin credencial ninguna -- se queda el valor por defecto de arriba.
    }
    return sendJson(res, 200, {
      ok: true,
      service: "rc-brain-service",
      embeddingsProvider: config.embeddingsProvider,
      testRun: config.testRun,
      anthropicConfigured: Boolean(config.anthropicApiKey), // histórico, mantenido por compatibilidad
      activeProvider,
      internalAuthConfigured: Boolean(config.internalToken),
    });
  }

  if (req.method === "POST" && url.pathname === "/neutrality-suite/run") {
    return handleNeutralitySuite(req, res);
  }

  const key = `${req.method} ${url.pathname}`;
  const handler = routes[key];
  if (!handler) return sendJson(res, 404, { error: "Ruta no encontrada." });

  try {
    const body = await readJsonBody(req);
    await handler(req, res, body);
  } catch (err) {
    const status = err.statusCode || 500;
    console.error(`[server] ${key} ->`, err.message);
    if (!res.headersSent) sendJson(res, status, { error: err.message || "Error interno." });
  }
});

startCleanup();
startProviderWatch();
server.listen(config.port, () => {
  console.log(`rc-brain-service escuchando en :${config.port} (embeddings=${config.embeddingsProvider}, anthropic=${Boolean(config.anthropicApiKey)})`);
});
