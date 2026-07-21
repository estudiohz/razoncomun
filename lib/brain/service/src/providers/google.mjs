// lib/brain/service/src/providers/google.mjs
//
// Adaptador Google (Gemini) -- misma interfaz que anthropic.mjs / openai.mjs:
//
//   chat({ apiKey, model, system, messages, maxTokens, temperature }) -> Promise<string>
//
// Usa generateContent (REST v1beta). Gemini no tiene un rol "system" en
// `contents` -- se manda por separado como `systemInstruction`, y el rol
// "assistant" de nuestra interfaz común se traduce a "model" (su nombre).

export async function chat({ apiKey, model, system, messages, maxTokens = 700, temperature = 0.2 }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const requestBody = {
    contents,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature,
      // Desactiva el "thinking" de los modelos Gemini 2.5+ (flash/pro). Para
      // respuestas RAG cortas y citadas NO queremos que el modelo gaste el
      // presupuesto de tokens razonando ni que filtre su borrador como
      // respuesta -- sin esto, gemini-flash-latest devolvía su scratchpad
      // ("Check constraints… Drafting the response…") en vez del texto final.
      // thinkingBudget:0 => respuesta directa. Verificado con gemini-flash-latest.
      thinkingConfig: { thinkingBudget: 0 },
    },
  };
  if (system) requestBody.systemInstruction = { parts: [{ text: system }] };

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`Respuesta no-JSON de Google (status ${res.status}): ${text.slice(0, 300)}`);
  }
  if (!res.ok) {
    throw new Error(`Google devolvió ${res.status}: ${body?.error?.message || text.slice(0, 300)}`);
  }
  const parts = body?.candidates?.[0]?.content?.parts;
  const textPart = Array.isArray(parts) ? parts.find((p) => typeof p.text === "string") : null;
  return textPart?.text ?? "";
}
