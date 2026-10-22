import { createVerify, generateKeyPairSync } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatosCarnet } from './modelo';

/**
 * El enlace "Añadir a Google Wallet" es un JWT RS256 firmado a mano con
 * `node:crypto` (D-C9, sin librerías). Es justo la clase de código que falla
 * EN SILENCIO: un `\n` mal escapado en la clave y el botón simplemente no
 * sale, sin ningún error que ver. Estos tests lo ejercitan con una clave RSA
 * generada al vuelo, así que no dependen de las credenciales reales — y
 * comprueban la firma de verdad, con la clave pública, no solo "que devuelve
 * algo".
 */

const ISSUER = '3388000000023195044';
const SA = 'carnets@proyecto-prueba.iam.gserviceaccount.com';
const UID = '3f2a1b8c-5d6e-4f70-9a1b-2c3d4e5f6071';

const DATOS: DatosCarnet = {
  nombre: 'Ana García López',
  numeroSocio: '00042',
  socioDesde: 'Marzo 2026',
  verificado: false,
  urlVerificacion: 'https://razoncomun.com/carnet/v/abc.def',
};

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

async function cargar() {
  vi.resetModules();
  return import('./google');
}

function decodificar(enlace: string) {
  const jwt = enlace.replace('https://pay.google.com/gp/v/save/', '');
  const [cabecera, cuerpo, firma] = jwt.split('.');
  const json = (s: string) => JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));
  return { cabecera: json(cabecera), cuerpo: json(cuerpo), firma, firmado: `${cabecera}.${cuerpo}` };
}

describe('enlace de Google Wallet', () => {
  beforeEach(() => {
    process.env.GOOGLE_WALLET_ISSUER_ID = ISSUER;
    process.env.GOOGLE_WALLET_SA_EMAIL = SA;
    process.env.GOOGLE_WALLET_SA_KEY = PEM;
    process.env.NEXT_PUBLIC_SITE_URL = 'https://razoncomun.com';
  });

  afterEach(() => {
    delete process.env.GOOGLE_WALLET_ISSUER_ID;
    delete process.env.GOOGLE_WALLET_SA_EMAIL;
    delete process.env.GOOGLE_WALLET_SA_KEY;
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  it('la firma verifica con la clave pública: es un JWT RS256 de verdad', async () => {
    const { enlaceGoogleWallet } = await cargar();
    const enlace = enlaceGoogleWallet(UID, DATOS);
    expect(enlace).toMatch(/^https:\/\/pay\.google\.com\/gp\/v\/save\//);

    const { cabecera, firmado, firma } = decodificar(enlace!);
    expect(cabecera).toEqual({ alg: 'RS256', typ: 'JWT' });

    const ok = createVerify('RSA-SHA256')
      .update(firmado)
      .verify(publicKey, Buffer.from(firma, 'base64url'));
    expect(ok).toBe(true);
  });

  it('los claims son los que Google exige para "save to wallet"', async () => {
    const { enlaceGoogleWallet } = await cargar();
    const { cuerpo } = decodificar(enlaceGoogleWallet(UID, DATOS)!);

    expect(cuerpo.iss).toBe(SA);
    expect(cuerpo.aud).toBe('google');
    expect(cuerpo.typ).toBe('savetowallet');
    // Google rechaza el JWT si el botón se pulsa desde un origen que no esté aquí.
    expect(cuerpo.origins).toEqual(['https://razoncomun.com']);
    expect(typeof cuerpo.iat).toBe('number');
  });

  it('la clase y el objeto cuelgan del issuer correcto, y no se mezclan con la cuenta abandonada', async () => {
    const { enlaceGoogleWallet } = await cargar();
    const { cuerpo } = decodificar(enlaceGoogleWallet(UID, DATOS)!);
    const objeto = cuerpo.payload.genericObjects[0];

    expect(objeto.classId).toBe(`${ISSUER}.rc_socio`);
    // El id del objeto lleva el uid SIN guiones: rotar el uid genera un pase
    // nuevo en vez de pisar el viejo (carnet perdido).
    expect(objeto.id).toBe(`${ISSUER}.3f2a1b8c5d6e4f709a1b2c3d4e5f6071`);
    // Los dos issuers se parecen muchísimo (…195044 vs …195041): si algún día
    // se cuela el de la cuenta personal, esto salta en vez de dar un 403.
    expect(JSON.stringify(cuerpo)).not.toContain('3388000000023195041');
  });

  it('el logo es el cuadrado de 1024 y no el icono de 512 que Google rechazaría', async () => {
    const { enlaceGoogleWallet } = await cargar();
    const { cuerpo } = decodificar(enlaceGoogleWallet(UID, DATOS)!);
    expect(cuerpo.payload.genericObjects[0].logo.sourceUri.uri).toBe(
      'https://razoncomun.com/logo-rc-wallet.png',
    );
  });

  it('lleva los datos del socio y un QR que apunta al verificador', async () => {
    const { enlaceGoogleWallet } = await cargar();
    const objeto = decodificar(enlaceGoogleWallet(UID, DATOS)!).cuerpo.payload.genericObjects[0];

    expect(objeto.header.defaultValue.value).toBe('Ana García López');
    expect(objeto.subheader.defaultValue.value).toBe('Carnet de socio');
    expect(objeto.textModulesData.map((t: { body: string }) => t.body)).toEqual(['00042', 'Marzo 2026']);
    expect(objeto.barcode).toMatchObject({ type: 'QR_CODE', value: DATOS.urlVerificacion });
  });

  it('el socio verificado lo dice en el subtítulo', async () => {
    const { enlaceGoogleWallet } = await cargar();
    const objeto = decodificar(enlaceGoogleWallet(UID, { ...DATOS, verificado: true })!).cuerpo.payload
      .genericObjects[0];
    expect(objeto.subheader.defaultValue.value).toBe('Carnet de socio verificado');
  });

  it('acepta la clave pegada en UNA línea con "\\n" literales, que es como queda en Dokploy', async () => {
    // Es el caso real: el .env de Dokploy no admite saltos de línea, así que
    // la clave del JSON de Google se pega tal cual, con `\n` de dos caracteres.
    process.env.GOOGLE_WALLET_SA_KEY = PEM.replace(/\n/g, '\\n');
    const { enlaceGoogleWallet } = await cargar();
    const enlace = enlaceGoogleWallet(UID, DATOS);
    expect(enlace).not.toBeNull();

    const { firmado, firma } = decodificar(enlace!);
    const ok = createVerify('RSA-SHA256')
      .update(firmado)
      .verify(publicKey, Buffer.from(firma, 'base64url'));
    expect(ok).toBe(true);
  });

  it('sin credenciales no hay botón y no se rompe nada', async () => {
    delete process.env.GOOGLE_WALLET_SA_KEY;
    const { enlaceGoogleWallet, googleWalletDisponible } = await cargar();
    expect(googleWalletDisponible()).toBe(false);
    expect(enlaceGoogleWallet(UID, DATOS)).toBeNull();
  });

  it('con una sola de las tres variables tampoco: a medias es lo mismo que nada', async () => {
    delete process.env.GOOGLE_WALLET_ISSUER_ID;
    delete process.env.GOOGLE_WALLET_SA_EMAIL;
    const { enlaceGoogleWallet } = await cargar();
    expect(enlaceGoogleWallet(UID, DATOS)).toBeNull();
  });
});
