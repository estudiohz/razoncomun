import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Token del QR del carnet: `<carnet_uid>.<firma>` (D-C3).
 *
 * La firma no protege un secreto — el `carnet_uid` no lo es, va impreso en el
 * QR. Lo que compra es que un token inventado se rechaza SIN TOCAR LA BASE DE
 * DATOS: el verificador es público (tiene que poder escanearlo cualquiera sin
 * cuenta), así que sin esto sería un endpoint abierto que hace una consulta
 * por cada petición que le llegue.
 *
 * Mismo patrón que `lib/antibot/captcha.ts`: HMAC-SHA256, comparación en
 * tiempo constante y SIN `server-only` — ese import no se resuelve bajo
 * vitest y este módulo tiene tests. El secreto no se filtra igualmente: sin
 * prefijo `NEXT_PUBLIC_`, Next no lo mete en el bundle del navegador.
 */

const SECRETO_FALLBACK_DEV = 'rc-carnet-dev-no-usar-en-produccion';

function obtenerSecreto(): string {
  const secreto = process.env.CARNET_SECRET;

  // En producción NO se cae a un fallback. Si se cayera, los tokens firmados
  // en desarrollo valdrían en producción y cualquiera que hubiera visto el
  // código podría fabricar carnets válidos. Es la lección de `ANTIBOT_SECRET`,
  // que se quedó sin poner en Dokploy y nadie se enteró hasta mucho después:
  // fallar en el arranque es incómodo, fallar en silencio es peor.
  if (!secreto) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Falta CARNET_SECRET. Ponla en Dokploy antes de desplegar el carnet.');
    }
    return SECRETO_FALLBACK_DEV;
  }
  return secreto;
}

function firmar(uid: string): string {
  return createHmac('sha256', obtenerSecreto()).update(uid).digest('hex');
}

/**
 * ¿Está el carnet operativo en este entorno?
 *
 * En producción `obtenerSecreto()` LANZA si falta `CARNET_SECRET` — y debe
 * seguir lanzando, es lo que impide que un secreto de desarrollo acabe
 * firmando carnets reales. Pero una excepción sin capturar en una página de
 * Next es un 500 sin explicación. Con esto, las páginas preguntan primero y
 * dicen "todavía no está configurado" en vez de romperse.
 */
export function carnetOperativo(): boolean {
  try {
    obtenerSecreto();
    return true;
  } catch {
    return false;
  }
}

/** Token completo para meter en el QR. */
export function crearTokenCarnet(carnetUid: string): string {
  return `${carnetUid}.${firmar(carnetUid)}`;
}

/**
 * Devuelve el `carnet_uid` si el token es legítimo, o null. Nunca lanza: un
 * token corrupto es un caso ESPERADO (alguien escaneando cualquier cosa), no
 * un error del sistema.
 */
export function leerTokenCarnet(token: string | undefined | null): string | null {
  if (!token) return null;

  const partes = token.split('.');
  if (partes.length !== 2) return null;

  const [uid, firmaRecibida] = partes;

  // Formato de uuid antes de calcular nada: descarta la basura evidente.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uid)) return null;
  if (!/^[0-9a-f]{64}$/i.test(firmaRecibida)) return null;

  // `firmar()` lanza en producción si falta CARNET_SECRET, y este módulo
  // promete no lanzar: el verificador es una página pública y una excepción
  // aquí es un 500 en la cara de quien escanea. Sin secreto no se puede
  // comprobar nada, así que el token no vale — fallar cerrado es lo correcto.
  let esperada: string;
  try {
    esperada = firmar(uid);
  } catch {
    return null;
  }

  const bufRecibida = Buffer.from(firmaRecibida, 'hex');
  const bufEsperada = Buffer.from(esperada, 'hex');

  if (bufRecibida.length !== bufEsperada.length) return null;
  if (!timingSafeEqual(bufRecibida, bufEsperada)) return null;

  return uid.toLowerCase();
}
