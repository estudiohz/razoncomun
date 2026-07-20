// lib/brain/service/src/providers/index.mjs
//
// Registro de adaptadores de proveedor de IA (D-016). Interfaz común que
// TODOS cumplen -- así llm.mjs (y por tanto el resto del servicio) puede
// llamar a "el proveedor activo" sin un switch/case esparcido por el código:
//
//   chat({ apiKey, model, system, messages, maxTokens, temperature }) -> Promise<string>
//
// - apiKey / model: SIEMPRE vienen resueltos desde fuera (credentialStore.mjs),
//   nunca de variables de entorno leídas directamente por el adaptador.
// - system: string (o null) con el prompt de sistema.
// - messages: array [{ role: 'user'|'assistant', content: string }].
// - Devuelve el texto de la primera respuesta ("text block") del modelo, como
//   string plano -- la extracción/validación de JSON (para classifyJson) vive
//   en llm.mjs, NO aquí, para no duplicarla en cada adaptador.
//
// Añadir un proveedor nuevo = un archivo más en esta carpeta + una línea en
// ADAPTERS. La tabla `ai_provider_credentials` (0016_ai_provider_credentials.sql,
// propiedad de rc-02) ya restringe `provider` a exactamente estos tres valores
// vía CHECK -- si se añade un cuarto adaptador aquí, coordinar con rc-02 para
// ampliar ese CHECK antes de que ai_credentials_set() pueda aceptarlo.

import * as anthropicAdapter from "./anthropic.mjs";
import * as openaiAdapter from "./openai.mjs";
import * as googleAdapter from "./google.mjs";

const ADAPTERS = {
  anthropic: anthropicAdapter,
  openai: openaiAdapter,
  google: googleAdapter,
};

export const SUPPORTED_PROVIDERS = Object.keys(ADAPTERS);

export class UnsupportedProviderError extends Error {
  constructor(provider) {
    super(`Proveedor de IA no soportado: "${provider}" (soportados: ${SUPPORTED_PROVIDERS.join(", ")}).`);
    this.name = "UnsupportedProviderError";
  }
}

export function getAdapter(provider) {
  const adapter = ADAPTERS[provider];
  if (!adapter) throw new UnsupportedProviderError(provider);
  return adapter;
}
