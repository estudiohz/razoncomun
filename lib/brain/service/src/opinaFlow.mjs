// lib/brain/service/src/opinaFlow.mjs
//
// El "entrevistador" de Opina (docs/tecnico/chatbot-opina.md): NO es un
// chatbot de soporte, es una máquina de estados mínima de 3 pasos --
// apertura contextual, máximo 1-2 repreguntas, cierre con bucle de retorno --
// que se apoya en el clasificador ya existente (opinions.mjs) para el
// etiquetado final. El estado NO vive en el servidor (proceso sin memoria de
// sesión): el cliente manda `history` completo en cada turno y este módulo
// decide el siguiente paso a partir de su longitud -- así el servicio puede
// reiniciarse sin perder conversaciones a medio hacer, y no hace falta una
// tabla de "sesiones de opina" nueva (fuera de la zona de rc-02 igualmente).
//
// Repreguntas: si hay ANTHROPIC_API_KEY configurada se genera una repregunta
// específica al comentario ("¿qué letra pequeña te preocupa?"); sin ella, se
// usa una repregunta genérica fija -- degradación explícita, nunca un error
// confuso (ver server.mjs: /health ya declara si Anthropic está configurada).

import { classifyAndStoreOpinion } from "./opinions.mjs";
import { classifyJson, generate, AnthropicNotConfiguredError } from "./llm.mjs";

const OPENING_MESSAGE =
  "Soy la IA de \"Opina\", de Razón Común. No decido nada -- solo te escucho, clasifico tu opinión y la comunidad la delibera y la vota; puede acabar en el programa. Cuéntame: ¿qué cambiarías de España, o qué opinas de una de nuestras propuestas? (Y si quieres, dime también si eres autónomo, funcionario, estudiante, jubilado... o prefieres no decirlo).";

const GENERIC_FOLLOWUP =
  "Gracias por contarlo. Para entenderlo mejor: ¿qué es concretamente lo que más te preocupa o cambiarías, y por qué?";

const CLOSE_SIGNALS = /\b(no,?\s*gracias|nada\s+m[aá]s|ya\s+est[aá]|eso\s+es\s+todo|no\s+tengo\s+m[aá]s|ya\s+he\s+dicho)\b/i;

function extractSegment(text) {
  const t = text.toLowerCase();
  if (/\bautóno/.test(t) || /\bautono/.test(t)) return "autonomo";
  if (/funcionari/.test(t)) return "funcionario";
  if (/estudiant/.test(t)) return "estudiante";
  if (/jubilad|pensionista/.test(t)) return "jubilado";
  return null;
}

async function generateFollowUp(userText) {
  try {
    const reply = await generate({
      system:
        "Eres el entrevistador de Opina (Razón Común). El ciudadano acaba de dar su opinión. Haz UNA sola repregunta breve, concreta y neutral (nunca ideológica, nunca de izquierda/derecha) para profundizar en su argumento -- por ejemplo qué letra pequeña le preocupa o qué condición pondría. Máximo 2 frases. No repitas su comentario textualmente, no des tu propia opinión, no menciones que eres una IA otra vez (ya se declaró al abrir la conversación).",
      userTurn: `Comentario del ciudadano:\n"""${userText}"""`,
    });
    return reply.trim() || GENERIC_FOLLOWUP;
  } catch (err) {
    if (err instanceof AnthropicNotConfiguredError) return GENERIC_FOLLOWUP;
    console.error("[opinaFlow] fallo generando repregunta, usando genérica:", err.message);
    return GENERIC_FOLLOWUP;
  }
}

function closingMessage(classification) {
  const points = classification?.points?.length ? classification.points.join(", ") : null;
  const puntoTexto = points ? `sobre el punto ${points} del programa` : "fuera del programa actual (¡nos sirve igual!)";
  return (
    `Gracias, registrado ${puntoTexto}. Cada mes publicamos qué cambió gracias a estas opiniones en el mapa público de consenso. ` +
    `Si quieres, puedes afiliarte o seguir el Programa Vivo para ver en qué queda tu aportación -- eso ya es opcional y no hace falta ahora.`
  );
}

/**
 * @param {{message: string|null, history: {role:'user'|'assistant', text:string}[], channel: string, segment: string|null, userId: string|null}} params
 */
export async function runOpinaTurn({ message, history, channel, segment, userId }) {
  const userTurnsSoFar = history.filter((h) => h.role === "user").length;

  // Turno 0: apertura contextual, sin necesidad de LLM (determinista).
  if (!message) {
    return { reply: OPENING_MESSAGE, done: false, history: [{ role: "assistant", text: OPENING_MESSAGE }] };
  }

  const newHistory = [...history, { role: "user", text: message }];
  const detectedSegment = segment || extractSegment(message);
  const userWantsToClose = CLOSE_SIGNALS.test(message);

  // Primer mensaje sustantivo del usuario (tras la apertura) y no pide cerrar
  // todavía -> máximo 1 repregunta antes del cierre.
  if (userTurnsSoFar === 0 && !userWantsToClose) {
    const followUp = await generateFollowUp(message);
    return { reply: followUp, done: false, history: [...newHistory, { role: "assistant", text: followUp }] };
  }

  // Segundo mensaje (o el usuario ya pidió cerrar): clasificar TODO lo dicho
  // y cerrar el bucle.
  const rawText = newHistory
    .filter((h) => h.role === "user")
    .map((h) => h.text)
    .join("\n");

  const opinion = await classifyAndStoreOpinion({ rawText, channel, segment: detectedSegment, userId });
  const closing = closingMessage(opinion);
  return {
    reply: closing,
    done: true,
    stored: opinion,
    history: [...newHistory, { role: "assistant", text: closing }],
  };
}

export { OPENING_MESSAGE, GENERIC_FOLLOWUP };
