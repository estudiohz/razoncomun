import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const UID = '3f2a1b8c-5d6e-4f70-9a1b-2c3d4e5f6071';

async function cargar(secreto?: string, entorno?: string) {
  vi.resetModules();
  if (secreto === undefined) delete process.env.CARNET_SECRET;
  else process.env.CARNET_SECRET = secreto;
  if (entorno) vi.stubEnv('NODE_ENV', entorno);
  return import('./token');
}

describe('token del carnet', () => {
  const original = process.env.CARNET_SECRET;

  beforeEach(() => {
    process.env.CARNET_SECRET = 'secreto-de-prueba';
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    if (original === undefined) delete process.env.CARNET_SECRET;
    else process.env.CARNET_SECRET = original;
  });

  it('el token que se firma es el que se lee', async () => {
    const { crearTokenCarnet, leerTokenCarnet } = await cargar('secreto-de-prueba');
    expect(leerTokenCarnet(crearTokenCarnet(UID))).toBe(UID);
  });

  it('rechaza el token con la firma manipulada', async () => {
    const { crearTokenCarnet, leerTokenCarnet } = await cargar('secreto-de-prueba');
    const token = crearTokenCarnet(UID);
    const [uid, firma] = token.split('.');
    // Cambiar UN carácter de la firma basta.
    const alterada = (firma[0] === 'a' ? 'b' : 'a') + firma.slice(1);
    expect(leerTokenCarnet(`${uid}.${alterada}`)).toBeNull();
  });

  it('rechaza el token con el uid cambiado, aunque la firma sea válida para otro', async () => {
    const { crearTokenCarnet, leerTokenCarnet } = await cargar('secreto-de-prueba');
    const firmaDeOtro = crearTokenCarnet('11111111-2222-4333-8444-555555555555').split('.')[1];
    expect(leerTokenCarnet(`${UID}.${firmaDeOtro}`)).toBeNull();
  });

  it('un token firmado con OTRO secreto no vale', async () => {
    const { crearTokenCarnet } = await cargar('secreto-de-dev');
    const tokenAjeno = crearTokenCarnet(UID);
    const { leerTokenCarnet } = await cargar('secreto-de-produccion');
    expect(leerTokenCarnet(tokenAjeno)).toBeNull();
  });

  it('rechaza basura sin reventar', async () => {
    const { leerTokenCarnet } = await cargar('secreto-de-prueba');
    for (const basura of ['', '   ', 'sin-punto', 'a.b', `${UID}.`, `.${'0'.repeat(64)}`, 'x'.repeat(200)]) {
      expect(leerTokenCarnet(basura)).toBeNull();
    }
    expect(leerTokenCarnet(undefined)).toBeNull();
    expect(leerTokenCarnet(null)).toBeNull();
  });

  it('acepta el uid en mayúsculas y lo devuelve normalizado', async () => {
    const { crearTokenCarnet, leerTokenCarnet } = await cargar('secreto-de-prueba');
    const token = crearTokenCarnet(UID.toUpperCase());
    // La firma se calcula sobre lo que se le pasa, así que el token de un uid
    // en mayúsculas es válido, pero el uid sale en minúsculas para poder
    // compararlo con lo que guarda Postgres.
    expect(leerTokenCarnet(token)).toBe(UID);
  });

  it('en producción SIN secreto lanza, en vez de caer a un fallback', async () => {
    const { crearTokenCarnet } = await cargar(undefined, 'production');
    expect(() => crearTokenCarnet(UID)).toThrow(/CARNET_SECRET/);
  });
});
