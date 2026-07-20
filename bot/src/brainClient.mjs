// bot/src/brainClient.mjs
// Cliente HTTP hacia rc-brain-service -- el bot NUNCA toca Postgres/Ollama/
// Anthropic directamente, solo estos dos endpoints internos (Bearer token).
import { config } from "./config.mjs";

async function post(path, body) {
  const res = await fetch(`${config.brainServiceUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.brainInternalToken}`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `rc-brain-service devolvió ${res.status}`);
  return json;
}

/** @RC-Brain <pregunta> en el canal del equipo -- corpus completo (público + interno). */
export function askTeamChat(message, sessionId) {
  return post("/chat-team", { message, sessionId });
}

/** /opina <texto> -- clasificación directa de un comentario (sin la entrevista
 *  multi-turno del widget web: el contexto de un slash command de Discord no
 *  se presta bien a un hilo de 2-3 idas y vueltas con estado -- ver README). */
export function classifyOpinion({ rawText, userId, segment }) {
  return post("/classify-opinion", { rawText, channel: "discord", userId, segment });
}
