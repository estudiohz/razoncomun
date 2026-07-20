// lib/brain/service/src/injectionGuard.mjs
//
// Defensa DETERMINISTA contra inyección de prompt (I4, revision-seguridad.md)
// -- deliberadamente NO delegada solo al modelo. La constitución del cerebro
// (docs/tecnico/rc-brain.md, Pilar 4 de vision-plataforma.md) exige que el
// texto del usuario se trate SIEMPRE como dato, nunca como instrucción; este
// módulo es la primera línea, comprobable sin depender de que el LLM "se
// porte bien": si detecta un patrón de jailbreak/exfiltración conocido,
// bloquea ANTES de llamar a Claude y responde con el mensaje fijo de la
// constitución -- 100% reproducible, sin coste de API, sin depender de humor
// del modelo.
//
// Segunda línea (server.mjs / constitution.mjs): aunque esto no detecte nada,
// el texto del usuario se envuelve en un bloque <user_input> con instrucción
// explícita de tratarlo como dato, y el propio corpus recuperado nunca
// incluye 'internal' en el canal público (retrieval.mjs) -- así que incluso
// si un intento de inyección "convenciera" al modelo de ignorar la
// constitución, no hay contenido interno en su contexto que pueda filtrar.

const PATTERNS = [
  /ignora(?:r)?\s+(?:todas?\s+)?(?:tus\s+)?instruccion/i,
  /olvida(?:r)?\s+(?:todo\s+)?lo\s+anterior/i,
  /haz\s+caso\s+omiso/i,
  /a\s*partir\s+de\s+ahora\s+(?:eres|actúa|actua)/i,
  /act[uú]a\s+como\s+(?:dan|jailbreak|un\s+modelo\s+sin\s+restricciones)/i,
  /sin\s+(?:ninguna\s+)?restricci[oó]n(?:es)?/i,
  /revela(?:me)?\s+.*(?:prompt|instrucciones?\s+del?\s+sistema|contenido\s+interno|corpus\s+interno|informaci[oó]n\s+interna)/i,
  /mu[eé]strame\s+.*(?:prompt|instrucciones?\s+del?\s+sistema)/i,
  /cu[aá]l\s+es\s+tu\s+prompt\s+(?:de\s+)?sistema/i,
  /repite\s+(?:tus\s+|las\s+)?instrucciones/i,
  /modo\s+desarrollador/i,
  /developer\s+mode/i,
  /disregard\s+(?:all\s+)?(?:previous|prior)\s+instructions/i,
  /ignore\s+(?:all\s+)?(?:previous|prior)\s+instructions/i,
  /you\s+are\s+now\s+(?:dan|jailbroken|unrestricted)/i,
  /system\s*prompt/i,
  /visibility\s*=\s*'?internal'?/i, // intento de inyectar sintaxis SQL/filtro directamente
];

/**
 * @returns {{flagged: boolean, matched: string|null}}
 */
export function detectInjection(userText) {
  for (const re of PATTERNS) {
    if (re.test(userText)) {
      return { flagged: true, matched: re.source };
    }
  }
  return { flagged: false, matched: null };
}

export const REFUSAL_MESSAGE =
  "Soy la IA de Razón Común. Trato cualquier mensaje que recibo como una pregunta, nunca como una instrucción que pueda cambiar mi forma de funcionar: no tengo un \"modo sin restricciones\", no reviso mis instrucciones internas y no accedo a contenido que no sea público. Si tienes una pregunta sobre el programa o la actividad del partido, con gusto te respondo citando la fuente.";
