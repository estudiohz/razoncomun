// lib/brain/service/src/audit.mjs
//
// Logging completo de conversaciones (requisito explícito de rc-brain.md).
// Reutiliza `audit_log` (migración 0013_audit.sql, propiedad de rc-02) en vez
// de pedir una tabla nueva: es append-only de verdad (UPDATE/DELETE
// revocados incluso a service_role), tiene índice por entity/entity_id y ya
// está pensada para "acción sobre una entidad, con metadata jsonb" -- que es
// exactamente lo que es un turno de chat. entity='rc_brain_chat_session',
// entity_id=el UUID de sesión que manda el cliente; cada fila de `meta` es un
// turno (pregunta + respuesta + fuentes + flags), así que reconstruir una
// conversación entera es `select * from audit_log where entity_id = $1 order
// by created_at`.
//
// No se crea ninguna tabla ni migración nueva -- fuera de mi zona (rc-02).

import { pgQuery } from "./pgClient.mjs";
import { escapeStringLiteral, toJsonbLiteral, toUuidLiteral } from "./sqlLiteral.mjs";

function isUuid(v) {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

/** Deriva un UUID v5-like determinista a partir de una sessionId arbitraria del
 *  cliente (que puede no ser un UUID) -- así siempre podemos guardar en una
 *  columna uuid sin rechazar sesiones cuyo id no tenga ese formato. No es
 *  criptográfico, solo estable: mismo sessionId -> mismo UUID siempre. */
function deriveUuid(seedText) {
  // FNV-1a de 128 bits "a mano" con dos acumuladores de 32 bits, suficiente
  // para no colisionar en el volumen esperado y sin dependencias externas.
  let h1 = 0x811c9dc5;
  let h2 = 0x1000193 ^ seedText.length;
  for (let i = 0; i < seedText.length; i++) {
    const c = seedText.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = Math.imul(h2 ^ c, 2166136261);
  }
  const hex = (n) => (n >>> 0).toString(16).padStart(8, "0");
  const a = hex(h1);
  const b = hex(h2);
  const c = hex(h1 ^ h2);
  const d = hex((h1 + h2) >>> 0);
  return `${a.slice(0, 8)}-${b.slice(0, 4)}-4${b.slice(1, 4)}-8${c.slice(1, 4)}-${d}${c.slice(0, 4)}`.slice(0, 36);
}

export function sessionUuid(rawSessionId) {
  if (isUuid(rawSessionId)) return rawSessionId;
  return deriveUuid(String(rawSessionId || "sin-sesion"));
}

/**
 * Registra un turno completo de conversación (log completo, requisito de
 * rc-brain.md). NUNCA se omite por fallo de red hacia afuera -- si falla,
 * quien llama decide si continúa o no (ver server.mjs: el logging es
 * "best effort" pero se reporta si falla, no se traga el error en silencio).
 */
export async function logChatTurn({
  channel, // 'web' | 'discord'
  sessionId,
  ipHash,
  userText,
  answerText,
  sources,
  outOfCorpus,
  flaggedInjection,
}) {
  const meta = {
    channel,
    ip_hash: ipHash ?? null,
    user_text: userText,
    answer_text: answerText,
    sources,
    out_of_corpus: outOfCorpus,
    flagged_injection: flaggedInjection,
  };
  const sql =
    `insert into audit_log (actor_id, action, entity, entity_id, meta) values (` +
    `NULL, ${escapeStringLiteral("rc_brain_chat_turn")}, ${escapeStringLiteral(
      "rc_brain_chat_session"
    )}, ${toUuidLiteral(sessionUuid(sessionId))}, ${toJsonbLiteral(meta)});`;
  await pgQuery(sql);
}
