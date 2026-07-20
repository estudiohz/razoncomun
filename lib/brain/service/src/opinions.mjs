// lib/brain/service/src/opinions.mjs
//
// Clasificador de Opina (docs/tecnico/chatbot-opina.md): cada comentario
// crudo entra y Claude lo etiqueta según el esquema de `opinions`
// (migración 0009_opinions.sql, propiedad de rc-02, no se toca). Salida
// SIEMPRE validada antes de insertar (I4: no confiar ciegamente en el JSON
// del modelo) -- valores fuera de los CHECK de la tabla se normalizan a algo
// seguro en vez de fallar el insert entero.

import { classifyJson } from "./anthropic.mjs";
import { pgQuery } from "./pgClient.mjs";
import {
  escapeStringLiteral,
  toIntArrayLiteral,
  toTextArrayLiteral,
  toUuidLiteral,
} from "./sqlLiteral.mjs";
import { MANIFESTO_POINTS } from "./manifestoIndex.mjs";

const VALID_STANCE = ["favor", "contra", "favor_condiciones", "duda"];
const VALID_KIND = ["opinion", "propuesta", "dato", "testimonio", "pregunta", "critica"];
const VALID_FLAGS = ["troll", "agresivo", "dato_dudoso", "bulo"];
const VALID_CHANNEL = ["web", "discord", "telegram"];

function classificationSystemPrompt() {
  return `Eres el clasificador interno de opiniones ciudadanas de Razón Común. Recibes un comentario en bruto de un ciudadano y debes etiquetarlo de forma neutral y consistente, SIN opinar tú, SIN ideología izquierda/derecha, basándote solo en lo que el texto dice literalmente.

Puntos del manifiesto disponibles (usa el/los número/s que apliquen; si no aplica a ninguno, usa un array vacío []):
${MANIFESTO_POINTS}

Responde EXCLUSIVAMENTE con un objeto JSON (nada de texto antes o después) con esta forma exacta:
{
  "points": [numeros de punto, ej. [17] o [] si no aplica a ninguno],
  "stance": "favor" | "contra" | "favor_condiciones" | "duda",
  "kind": "opinion" | "propuesta" | "dato" | "testimonio" | "pregunta" | "critica",
  "argument": "resumen en 1 frase, neutral, en tercera persona",
  "quality": 1 a 5 (1=ruido/vacío, 5=argumento sustancioso con razones concretas),
  "flags": array con las que apliquen entre "troll", "agresivo", "dato_dudoso", "bulo" (vacío si ninguna)
}

Importante: clasifica el MISMO argumento subyacente de forma IDÉNTICA sin importar si está redactado en tono/vocabulario asociado a izquierda o a derecha -- la neutralidad se audita periódicamente comparando pares. No dejes que el registro lingüístico cambie tu clasificación.`;
}

function validate(parsed) {
  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, error: "La salida no es un objeto." };
  }
  const points = Array.isArray(parsed.points)
    ? parsed.points.filter((p) => Number.isInteger(p) && p >= 1 && p <= 30)
    : [];
  const stance = VALID_STANCE.includes(parsed.stance) ? parsed.stance : "duda";
  const kind = VALID_KIND.includes(parsed.kind) ? parsed.kind : "opinion";
  const argument = typeof parsed.argument === "string" ? parsed.argument.slice(0, 500) : "";
  const quality = Number.isInteger(parsed.quality)
    ? Math.min(5, Math.max(1, parsed.quality))
    : 3;
  const flags = Array.isArray(parsed.flags) ? parsed.flags.filter((f) => VALID_FLAGS.includes(f)) : [];
  return { ok: true, data: { points, stance, kind, argument, quality, flags } };
}

/** Clasifica un texto crudo y devuelve la estructura validada (SIN insertar). */
export async function classifyOpinionText(rawText) {
  const result = await classifyJson({
    system: classificationSystemPrompt(),
    userTurn: `Comentario a clasificar:\n"""${rawText}"""`,
    validate,
  });
  return result;
}

/** Clasifica e inserta en `opinions`. */
export async function classifyAndStoreOpinion({ rawText, channel, segment, userId }) {
  if (!VALID_CHANNEL.includes(channel)) {
    throw new Error(`channel inválido: ${channel} (debe ser ${VALID_CHANNEL.join("|")})`);
  }
  const result = await classifyOpinionText(rawText);
  if (!result.ok) {
    throw new Error(`Clasificación fallida tras reintento: ${result.error}`);
  }
  const { points, stance, kind, argument, quality, flags } = result.data;
  const sql =
    `insert into opinions (user_id, channel, raw_text, points, stance, kind, argument, segment, quality, flags)\n` +
    `values (${userId ? toUuidLiteral(userId) : "NULL"}, ${escapeStringLiteral(channel)}, ` +
    `${escapeStringLiteral(rawText)}, ${toIntArrayLiteral(points)}, ${escapeStringLiteral(stance)}, ` +
    `${escapeStringLiteral(kind)}, ${escapeStringLiteral(argument)}, ` +
    `${segment ? escapeStringLiteral(segment) : "NULL"}, ${quality}, ${toTextArrayLiteral(flags)})\n` +
    `returning id, channel, points, stance, kind, argument, segment, quality, flags, created_at;`;
  const rows = await pgQuery(sql);
  return rows[0];
}
