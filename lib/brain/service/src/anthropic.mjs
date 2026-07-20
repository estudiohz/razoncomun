// lib/brain/service/src/anthropic.mjs
//
// Cliente mínimo (fetch, cero dependencias) contra la API de Mensajes de
// Anthropic. Usado SOLO para generación (respuesta del chat) y clasificación
// (Opina) -- NUNCA para embeddings, que son bge-m3/Ollama local por decisión
// cerrada (revision-seguridad.md "Decisión cerrada: embeddings del RC-Brain").
//
// Requiere ANTHROPIC_API_KEY (pendiente de Sergio, ver informe final de esta
// ola). Sin ella, `generate()`/`classify()` lanzan un error claro en vez de
// fallar de forma confusa -- y el servicio sigue sirviendo /health y dejando
// claro qué falta.

import { config } from "./config.mjs";

export class AnthropicNotConfiguredError extends Error {
  constructor() {
    super(
      "ANTHROPIC_API_KEY no está configurada. La generación/clasificación del RC-Brain no puede " +
        "funcionar sin ella (pendiente de Sergio -- ver informe de esta ola)."
    );
    this.name = "AnthropicNotConfiguredError";
  }
}

async function callMessages({ system, messages, maxTokens = 700, temperature = 0.2 }) {
  if (!config.anthropicApiKey) throw new AnthropicNotConfiguredError();

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": config.anthropicApiKey,
      "anthropic-version": config.anthropicVersion,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: config.anthropicModel,
      max_tokens: maxTokens,
      temperature,
      system,
      messages,
    }),
  });

  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`Respuesta no-JSON de Anthropic (status ${res.status}): ${text.slice(0, 300)}`);
  }
  if (!res.ok) {
    throw new Error(`Anthropic devolvió ${res.status}: ${body?.error?.message || text.slice(0, 300)}`);
  }
  const block = body?.content?.find((c) => c.type === "text");
  return block?.text ?? "";
}

/** Genera la respuesta del chat. `system` ya incluye la constitución completa. */
export async function generate({ system, userTurn }) {
  return callMessages({
    system,
    messages: [{ role: "user", content: userTurn }],
    maxTokens: 700,
    temperature: 0.2,
  });
}

/**
 * Clasificación estructurada (Opina). Pide JSON puro y lo valida; reintenta
 * una vez si la salida no parsea o no cumple el esquema mínimo -- salida no
 * validada nunca se acepta a ciegas (I4: no confiar en que el modelo siempre
 * obedezca el formato).
 */
export async function classifyJson({ system, userTurn, validate }) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const raw = await callMessages({
      system,
      messages: [{ role: "user", content: userTurn }],
      maxTokens: 400,
      temperature: 0,
    });
    const jsonText = extractJson(raw);
    try {
      const parsed = JSON.parse(jsonText);
      const validation = validate(parsed);
      if (validation.ok) return { ok: true, data: validation.data, raw };
      if (attempt === 2) return { ok: false, error: validation.error, raw };
    } catch (err) {
      if (attempt === 2) return { ok: false, error: `JSON inválido: ${err.message}`, raw };
    }
  }
  return { ok: false, error: "Fallo desconocido en classifyJson", raw: null };
}

function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return text;
  return text.slice(start, end + 1);
}
