// lib/brain/service/src/providers/anthropic.mjs
//
// Adaptador Anthropic -- uno de los tres soportados (D-016, junto a openai.mjs
// y google.mjs). Implementa la interfaz común descrita en index.mjs:
//
//   chat({ apiKey, model, system, messages, maxTokens, temperature }) -> Promise<string>
//
// Sin estado propio, sin leer config.mjs para credenciales -- las recibe SIEMPRE
// como parámetro (vienen de credentialStore.mjs, que a su vez las lee de
// ai_credentials_get_active() o, en su defecto, de ANTHROPIC_API_KEY de entorno).
// Esto es justo lo que hace que el resto del servicio (RAG, constitución,
// guardrail, rate limit, opinions.mjs, opinaFlow.mjs) no sepa ni le importe
// qué proveedor hay detrás: llaman a llm.mjs, que resuelve credencial+adaptador
// y les da un string de vuelta, siempre.

import { config } from "../config.mjs";

export async function chat({ apiKey, model, system, messages, maxTokens = 700, temperature = 0.2 }) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": config.anthropicVersion,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
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
