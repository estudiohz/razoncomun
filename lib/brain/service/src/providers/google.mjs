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

  // Minimiza el "thinking" de los modelos Gemini con razonamiento. Para
  // respuestas RAG cortas y citadas NO queremos que el modelo gaste el
  // presupuesto de tokens razonando ni que filtre su borrador como
  // respuesta -- sin esto, gemini-flash-latest devolvía su scratchpad
  // ("Check constraints… Drafting the response…") en vez del texto final.
  //
  // OJO, el parámetro correcto CAMBIA con la generación del modelo detrás
  // del alias -latest (ya nos ha pasado, 22-jul-2026): la familia 2.5
  // aceptaba `thinkingBudget: 0`; la que resuelve el alias ahora lo rechaza
  // con 400 INVALID_ARGUMENT y pide `thinkingLevel`. Por eso: (1) se manda
  // `thinkingLevel: "minimal"` (aceptado hoy, verificado contra la API), y
  // (2) si aún así Google devuelve 400 y llevábamos thinkingConfig, se
  // reintenta UNA vez sin él -- el chat degrada a "thinking por defecto"
  // (más lento/caro) en vez de romperse entero hasta que alguien toque
  // este fichero.
  const construirBody = (conThinking) => {
    const requestBody = {
      contents,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature,
        ...(conThinking ? { thinkingConfig: { thinkingLevel: "minimal" } } : {}),
      },
    };
    if (system) requestBody.systemInstruction = { parts: [{ text: system }] };
    return requestBody;
  };

  let conThinking = true;
  const opcionesActuales = () => ({
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(construirBody(conThinking)),
  });

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
      res = await fetch(url, opcionesActuales());
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
      // Nunca devolver una part de razonamiento (`thought: true`) como
      // respuesta, aunque el modelo la emita antes del texto final.
      const textPart = Array.isArray(parts)
        ? parts.find((p) => typeof p.text === "string" && !p.thought)
        : null;
      return textPart?.text ?? "";
    }

    const msg = body?.error?.message || text.slice(0, 300);

    if (res.status === 400 && conThinking) {
      // Parámetro de thinking rechazado por la generación de modelo actual
      // (ver comentario de construirBody): reintento inmediato sin él.
      conThinking = false;
      continue;
    }

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
