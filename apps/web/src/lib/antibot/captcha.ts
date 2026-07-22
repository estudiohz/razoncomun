import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Antibot de coste cero (D-P8, docs/tecnico/tablero-propuestas.md): desafío
 * aritmético "¿Cuánto es A + B?" firmado con HMAC. Sin tabla, sin estado, sin
 * servicio externo — el token lleva la respuesta correcta y la expiración,
 * firmados; el servidor solo verifica la firma, la expiración y que la
 * respuesta del usuario coincida.
 *
 * ⚠️ AVISO PARA SERGIO: `ANTIBOT_SECRET` debe existir como variable de
 * entorno server-only en Dokploy (dev y luego producción). Si no está
 * definida, se usa un fallback de desarrollo — NO es seguro en producción
 * (cualquiera con el código fuente podría forjar tokens). Añadir la env var
 * antes de considerar este captcha protegido en producción.
 */
const SECRETO_FALLBACK_DEV = 'rc-dev-fallback-antibot-secret-cambiar-en-produccion';

function obtenerSecreto(): string {
  return process.env.ANTIBOT_SECRET || SECRETO_FALLBACK_DEV;
}

const DURACION_MS = 5 * 60 * 1000; // 5 minutos

export interface DesafioCaptcha {
  pregunta: string;
  token: string;
}

function firmar(payload: string): string {
  return createHmac('sha256', obtenerSecreto()).update(payload).digest('hex');
}

/** Genera un desafío "¿Cuánto es A + B?" con token HMAC(respuesta|expiración). */
export function generarCaptcha(ahoraMs: number = Date.now()): DesafioCaptcha {
  const a = 2 + Math.floor(Math.random() * 8); // 2..9
  const b = 2 + Math.floor(Math.random() * 8);
  const respuesta = a + b;
  const expira = ahoraMs + DURACION_MS;
  const payload = `${respuesta}|${expira}`;
  const firma = firmar(payload);
  // token = payload en claro + firma; el payload no es secreto (solo la firma lo protege de manipulación)
  const token = Buffer.from(`${payload}|${firma}`, 'utf8').toString('base64url');
  return { pregunta: `¿Cuánto es ${a} + ${b}?`, token };
}

/** Verifica un token de captcha: firma válida, no expirado, respuesta correcta. */
export function verificarCaptcha(
  token: string,
  respuestaUsuario: string | number,
  ahoraMs: number = Date.now(),
): { ok: true } | { ok: false; error: string } {
  let decodificado: string;
  try {
    decodificado = Buffer.from(token, 'base64url').toString('utf8');
  } catch {
    return { ok: false, error: 'Token de verificación inválido.' };
  }

  const partes = decodificado.split('|');
  if (partes.length !== 3) return { ok: false, error: 'Token de verificación inválido.' };
  const [respuestaStr, expiraStr, firmaRecibida] = partes;

  const payload = `${respuestaStr}|${expiraStr}`;
  const firmaEsperada = firmar(payload);

  const bufRecibida = Buffer.from(firmaRecibida, 'utf8');
  const bufEsperada = Buffer.from(firmaEsperada, 'utf8');
  if (bufRecibida.length !== bufEsperada.length || !timingSafeEqual(bufRecibida, bufEsperada)) {
    return { ok: false, error: 'Token de verificación no válido (manipulado o corrupto).' };
  }

  const expira = Number(expiraStr);
  if (!Number.isFinite(expira) || ahoraMs > expira) {
    return { ok: false, error: 'La verificación ha caducado, vuelve a intentarlo.' };
  }

  const respuestaCorrecta = Number(respuestaStr);
  const respuestaDada = Number(respuestaUsuario);
  if (!Number.isFinite(respuestaDada) || respuestaDada !== respuestaCorrecta) {
    return { ok: false, error: 'Respuesta incorrecta.' };
  }

  return { ok: true };
}
