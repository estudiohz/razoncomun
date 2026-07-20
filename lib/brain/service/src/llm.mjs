// lib/brain/service/src/llm.mjs
//
// Capa de generación/clasificación AGNÓSTICA AL PROVEEDOR (D-016). Sustituye
// a lo que antes era anthropic.mjs como punto de entrada del resto del
// servicio -- opinions.mjs, opinaFlow.mjs y server.mjs importan generate()/
// classifyJson() de AQUÍ, no de un proveedor concreto. anthropic.mjs pasó a
// ser providers/anthropic.mjs, un adaptador más entre providers/openai.mjs y
// providers/google.mjs.
//
// Contrato que NO cambia respecto al anthropic.mjs original (para no romper
// nada ya verificado en la Ola 3): mismas firmas de generate()/classifyJson(),
// mismo nombre de excepción AnthropicNotConfiguredError (server.mjs y
// opinaFlow.mjs la capturan explícitamente por nombre). Lo que cambia es de
// dónde sale la credencial: antes config.anthropicApiKey fijo, ahora
// credentialStore.getActiveProviderConfig() -- que puede ser una fila de
// ai_provider_credentials (panel admin) o, si no hay ninguna, el mismo
// fallback de entorno de siempre.
//
// El RAG, la constitución, el guardrail anti-inyección y el rate limit NUNCA
// importan nada de aquí para saber "qué modelo hay detrás" -- solo llaman a
// generate()/classifyJson() y reciben texto. Ese es el punto de la
// abstracción: cambiar Anthropic->OpenAI->Google desde el panel no debe
// tocar ni una línea de retrieval.mjs, constitution.mjs, injectionGuard.mjs
// ni rateLimit.mjs.

import { getActiveProviderConfig, CredentialsNotConfiguredError } from "./credentialStore.mjs";
import { getAdapter } from "./providers/index.mjs";

export class AnthropicNotConfiguredError extends Error {
  constructor(detail) {
    super(
      detail ||
        "No hay ningún proveedor de IA configurado. La generación/clasificación del RC-Brain no " +
          "puede funcionar sin uno (configúralo desde el panel admin o define ANTHROPIC_API_KEY)."
    );
    // Nombre histórico deliberadamente conservado: server.mjs y opinaFlow.mjs
    // hacen `err instanceof AnthropicNotConfiguredError` y ese contrato ya
    // está verificado end-to-end (gate-brain.mjs) -- cambiarlo de nombre
    // rompería ese catch sin ningún beneficio. Alias explícito más abajo
    // para quien escriba código nuevo con el nombre correcto.
    this.name = "AnthropicNotConfiguredError";
  }
}

/** Alias con el nombre correcto -- mismo objeto, para código nuevo. */
export const ProviderNotConfiguredError = AnthropicNotConfiguredError;

async function resolveActiveProvider() {
  try {
    return await getActiveProviderConfig();
  } catch (err) {
    if (err instanceof CredentialsNotConfiguredError) throw new AnthropicNotConfiguredError();
    throw err;
  }
}

async function callActiveProvider({ system, messages, maxTokens, temperature }) {
  const cred = await resolveActiveProvider();
  const adapter = getAdapter(cred.provider);
  return adapter.chat({
    apiKey: cred.apiKey,
    model: cred.model,
    system,
    messages,
    maxTokens,
    temperature,
  });
}

/** Genera la respuesta del chat. `system` ya incluye la constitución completa. */
export async function generate({ system, userTurn }) {
  return callActiveProvider({
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
 * obedezca el formato). Mismo comportamiento independientemente de qué
 * proveedor esté activo -- cada adaptador solo promete devolver texto plano,
 * la extracción/validación de JSON es responsabilidad de esta capa.
 *
 * A diferencia del anthropic.mjs original, un fallo de RED/AUTENTICACIÓN al
 * llamar al proveedor (p.ej. credencial inválida, proveedor caído) se trata
 * IGUAL que una salida mal formada -- se reintenta una vez y, si persiste, se
 * devuelve { ok: false } en vez de dejar escapar la excepción. Esto es
 * deliberado y relevante para D-016: la suite de neutralidad (neutralitySuite.mjs)
 * clasifica los 16 pares llamando a classifyOpinionText -> classifyJson; si
 * una credencial recién activada desde el panel es inválida, el resultado
 * correcto es "0% equivalente, revertir" (providerWatcher.mjs lo detecta),
 * NUNCA que la suite entera aborte a mitad de camino con una excepción sin
 * capturar y deje el proveedor roto activo indefinidamente.
 */
export async function classifyJson({ system, userTurn, validate }) {
  let lastError = "fallo desconocido";
  for (let attempt = 1; attempt <= 2; attempt++) {
    let raw;
    try {
      raw = await callActiveProvider({
        system,
        messages: [{ role: "user", content: userTurn }],
        maxTokens: 400,
        temperature: 0,
      });
    } catch (err) {
      lastError = `Fallo llamando al proveedor de IA: ${err.message}`;
      if (attempt === 2) return { ok: false, error: lastError, raw: null };
      continue;
    }
    const jsonText = extractJson(raw);
    try {
      const parsed = JSON.parse(jsonText);
      const validation = validate(parsed);
      if (validation.ok) return { ok: true, data: validation.data, raw };
      lastError = validation.error;
      if (attempt === 2) return { ok: false, error: lastError, raw };
    } catch (err) {
      lastError = `JSON inválido: ${err.message}`;
      if (attempt === 2) return { ok: false, error: lastError, raw };
    }
  }
  return { ok: false, error: lastError, raw: null };
}

function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return text;
  return text.slice(start, end + 1);
}
