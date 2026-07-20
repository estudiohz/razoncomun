// lib/brain/service/src/providers/openai.mjs
//
// Adaptador OpenAI -- misma interfaz que anthropic.mjs / google.mjs:
//
//   chat({ apiKey, model, system, messages, maxTokens, temperature }) -> Promise<string>
//
// Usa el endpoint clásico /v1/chat/completions (system como mensaje role:
// "system", igual que el resto de proveedores esperan un `system` separado
// de la conversación) -- es el más portable entre modelos gpt-4o/gpt-4.1/etc.
// sin acoplarse a extras de la Responses API que no necesitamos aquí (solo
// generación de texto plano / JSON, sin tools ni streaming).

export async function chat({ apiKey, model, system, messages, maxTokens = 700, temperature = 0.2 }) {
  const openaiMessages = [
    ...(system ? [{ role: "system", content: system }] : []),
    ...messages.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    })),
  ];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: openaiMessages,
      max_tokens: maxTokens,
      temperature,
    }),
  });

  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`Respuesta no-JSON de OpenAI (status ${res.status}): ${text.slice(0, 300)}`);
  }
  if (!res.ok) {
    throw new Error(`OpenAI devolvió ${res.status}: ${body?.error?.message || text.slice(0, 300)}`);
  }
  const content = body?.choices?.[0]?.message?.content;
  return content ?? "";
}
