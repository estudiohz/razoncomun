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

  const opciones = {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(requestBody),
  };

  // Reintentos ante picos TRANSITORIOS de servidor de Google (503 "high demand",
  // 5xx) o fallos de red: hasta 3 intentos con backoff corto. Los picos del alias
  // gemini-flash-latest son habituales y pasajeros y suelen despejarse en <2s.
  // NO se reintenta el 429 (cuota del free tier, p. ej. 20 req/min): pide esperar
  // ~30s, así que un backoff corto no lo despeja y solo retrasaría el error; se
  // falla rápido y quien pregunta reintenta en un momento.
  const REINTENTABLE = new Set([500, 502, 503, 504]);
  const MAX = 3;
  let ultimoError;

  for (let intento = 1; intento <= MAX; intento++) {
    let res;
    try {
      res = await fetch(url, opciones);
    } catch (err) {
      ultimoError = new Error(`Fallo de red hablando con Google: ${err.message}`);
      if (intento < MAX) {
        await esperar(intento);
        continue;
      }
      throw ultimoError;
    }

    const text = await res.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      /* respuesta no-JSON: se trata abajo según el status */
    }

    if (res.ok) {
      const parts = body?.candidates?.[0]?.content?.parts;
      const textPart = Array.isArray(parts) ? parts.find((p) => typeof p.text === "string") : null;
      return textPart?.text ?? "";
    }

    const msg = body?.error?.message || text.slice(0, 300);
    ultimoError = new Error(`Google devolvió ${res.status}: ${msg}`);
    if (res.status === 429) {
      // Cuota del free tier agotada. Se extraen los segundos sugeridos por
      // Google ("Please retry in 31.7s") para poder avisar a quien pregunta.
      const m = /retry in ([\d.]+)s/i.exec(msg);
      ultimoError.rateLimited = true;
      ultimoError.retryAfterSeconds = m ? Math.ceil(parseFloat(m[1])) : 30;
    }
    if (REINTENTABLE.has(res.status) && intento < MAX) {
      await esperar(intento);
      continue;
    }
    throw ultimoError;
  }

  throw ultimoError;
}

/** Backoff creciente: ~700 ms, ~1.6 s. */
function esperar(intento) {
  return new Promise((r) => setTimeout(r, 400 + intento * intento * 300));
}
