// apps/web/src/lib/brain/serviceClient.ts
//
// Cliente mínimo, server-side, hacia rc-brain-service (lib/brain/service/).
// Esta web NUNCA habla directamente con Postgres/Ollama/Anthropic para el
// chat -- todo pasa por el servicio persistente, que es el único sitio donde
// vive el filtro de visibilidad público/interno (I3) y el guardrail
// anti-inyección (I4). Los route handlers de /api/chat y /api/opina son
// proxies finos: reenvían el body del cliente + la IP real, y devuelven la
// respuesta del servicio tal cual (sin añadir lógica de negocio aquí).

const BRAIN_SERVICE_URL = (process.env.BRAIN_SERVICE_URL || '').replace(/\/+$/, '');

export class BrainServiceNotConfiguredError extends Error {
  constructor() {
    super(
      'BRAIN_SERVICE_URL no está configurada en la web. Pide a Sergio la URL pública de rc-brain-service (ver informe de rc-08-brain).',
    );
    this.name = 'BrainServiceNotConfiguredError';
  }
}

/**
 * @param path p.ej. '/chat' o '/opina/turn'
 * @param body el JSON del cliente, reenviado tal cual (nunca se le añade un
 *   campo `visibility` aquí -- aunque lo hiciera, el servicio lo ignora, ver
 *   lib/brain/service/src/retrieval.mjs)
 * @param clientIp IP real del visitante (de request.headers de Next), para
 *   que el rate limit por IP del servicio funcione incluso detrás del proxy
 *   de la web.
 */
export async function callBrainService(path: string, body: unknown, clientIp: string | null) {
  if (!BRAIN_SERVICE_URL) throw new BrainServiceNotConfiguredError();

  const res = await fetch(`${BRAIN_SERVICE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(clientIp ? { 'X-Forwarded-For': clientIp } : {}),
    },
    body: JSON.stringify(body ?? {}),
    // El chat es conversacional, no cacheable.
    cache: 'no-store',
  });

  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`rc-brain-service devolvió una respuesta no-JSON (status ${res.status}).`);
  }
  return { status: res.status, body: json };
}

export function clientIpFrom(request: Request): string | null {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return null;
}
