import { createSign } from 'node:crypto';
import type { DatosCarnet } from './modelo';
import { urlSitio } from '@/lib/supabase/env';

/**
 * Enlace "Añadir a Google Wallet" (D-C8).
 *
 * CERO DEPENDENCIAS (D-C9): el botón de Google Wallet es una URL con un JWT
 * RS256 dentro, y firmarlo son quince líneas de `node:crypto`. Traer `jose` o
 * `google-auth-library` para esto sería arrastrar un árbol de dependencias a
 * cambio de nada.
 *
 * El objeto del pase viaja INLINE dentro del JWT, así que el primer guardado
 * no necesita llamar a la API de Google: basta con firmar. La API solo hace
 * falta más tarde, para marcar el pase como caducado cuando alguien se da de
 * baja.
 *
 * Si faltan las variables, `enlaceGoogleWallet` devuelve null y la interfaz
 * simplemente no enseña el botón. Es deliberado: mientras la cuenta de Issuer
 * de Google esté pendiente de aprobación, el resto del carnet (PDF y
 * verificador) tiene que funcionar igual.
 */

interface ConfigGoogle {
  issuerId: string;
  cuentaServicio: string;
  clavePrivada: string;
}

function configuracion(): ConfigGoogle | null {
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
  const cuentaServicio = process.env.GOOGLE_WALLET_SA_EMAIL;
  const clavePrivada = process.env.GOOGLE_WALLET_SA_KEY;

  if (!issuerId || !cuentaServicio || !clavePrivada) return null;

  // En Dokploy la clave privada se pega en una sola línea con `\n` literales:
  // sin esto, `createSign` no reconoce el PEM.
  return { issuerId, cuentaServicio, clavePrivada: clavePrivada.replace(/\\n/g, '\n') };
}

export function googleWalletDisponible(): boolean {
  return configuracion() !== null;
}

function base64url(dato: string | Buffer): string {
  return Buffer.from(dato).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** El identificador de la clase: una sola para todos los carnets. */
export function idClase(issuerId: string): string {
  return `${issuerId}.rc_socio`;
}

/**
 * El objeto del pase. Aquí es donde se nota que en la wallet NO se diseña,
 * se rellena una plantilla: Google da logo, título, cabecera, un par de
 * campos de texto y el código, y la maqueta la pone él.
 *
 * El fondo va en BLANCO y no con el espectro de la marca porque Google exige
 * un color plano — un degradado no es una opción aquí.
 */
export function objetoPase(issuerId: string, uid: string, datos: DatosCarnet) {
  const textos = [
    { header: 'Socio n.º', body: datos.numeroSocio, id: 'numero' },
    ...(datos.socioDesde ? [{ header: 'Socio desde', body: datos.socioDesde, id: 'desde' }] : []),
  ];

  return {
    id: `${issuerId}.${uid.replace(/-/g, '')}`,
    classId: idClase(issuerId),
    state: 'ACTIVE',
    hexBackgroundColor: '#FFFFFF',
    logo: {
      sourceUri: { uri: `${urlSitio()}/icono-rc.png` },
      contentDescription: { defaultValue: { language: 'es', value: 'Razón Común' } },
    },
    cardTitle: { defaultValue: { language: 'es', value: 'Razón Común' } },
    subheader: {
      defaultValue: {
        language: 'es',
        value: datos.verificado ? 'Carnet de socio verificado' : 'Carnet de socio',
      },
    },
    header: { defaultValue: { language: 'es', value: datos.nombre } },
    textModulesData: textos.map((t) => ({
      header: t.header,
      body: t.body,
      id: t.id,
    })),
    barcode: {
      type: 'QR_CODE',
      value: datos.urlVerificacion,
      alternateText: `Socio ${datos.numeroSocio}`,
    },
  };
}

/**
 * URL del botón. Null si aún no hay credenciales de Google configuradas.
 *
 * `uid` es el `carnet_uid`: al usarlo como identificador del objeto, rotar el
 * uid genera un pase NUEVO en vez de pisar el viejo, que es justo lo que se
 * quiere cuando alguien pierde el móvil.
 */
export function enlaceGoogleWallet(uid: string, datos: DatosCarnet): string | null {
  const config = configuracion();
  if (!config) return null;

  const cabecera = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const cuerpo = base64url(
    JSON.stringify({
      iss: config.cuentaServicio,
      aud: 'google',
      typ: 'savetowallet',
      iat: Math.floor(Date.now() / 1000),
      origins: [urlSitio()],
      payload: { genericObjects: [objetoPase(config.issuerId, uid, datos)] },
    }),
  );

  const firma = createSign('RSA-SHA256')
    .update(`${cabecera}.${cuerpo}`)
    .sign(config.clavePrivada);

  return `https://pay.google.com/gp/v/save/${cabecera}.${cuerpo}.${base64url(firma)}`;
}
