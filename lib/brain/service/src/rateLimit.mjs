// lib/brain/service/src/rateLimit.mjs
//
// Token bucket en memoria del propio proceso (I4, revision-seguridad.md).
// Límite deliberado y documentado: al ser en memoria, se resetea si el
// contenedor se reinicia y NO se comparte si algún día hay >1 réplica del
// servicio -- suficiente para el volumen esperado de Razón Común (un único
// contenedor, tráfico bajo/medio) y CERO coste (nada de Redis). Si el
// tráfico creciera lo bastante para necesitar réplicas, este es el primer
// sitio a sustituir por un backend compartido (Redis/Postgres).

const buckets = new Map(); // key -> { count, windowStart }
const WINDOW_MS = 60 * 60 * 1000; // 1 hora

function check(key, limit) {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: limit - 1 };
  }
  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterMs: WINDOW_MS - (now - entry.windowStart) };
  }
  entry.count += 1;
  return { allowed: true, remaining: limit - entry.count };
}

/** Limpieza periódica para no crecer sin límite en un proceso de larga duración. */
export function startCleanup() {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of buckets) {
      if (now - entry.windowStart > WINDOW_MS) buckets.delete(key);
    }
  }, WINDOW_MS).unref?.();
}

export function checkIpAndSession(ip, sessionId, { perIp, perSession }) {
  const ipResult = check(`ip:${ip}`, perIp);
  if (!ipResult.allowed) return { allowed: false, scope: "ip", ...ipResult };
  const sessionResult = check(`session:${sessionId}`, perSession);
  if (!sessionResult.allowed) return { allowed: false, scope: "session", ...sessionResult };
  return { allowed: true };
}

/** Solo para pruebas del gate: vaciar el estado entre corridas. */
export function _resetForTests() {
  buckets.clear();
}
