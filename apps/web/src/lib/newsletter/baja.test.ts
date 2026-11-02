import { beforeAll, describe, expect, it } from 'vitest';
import { tokenBaja, tokenBajaValido, urlBaja } from './baja';

const U = '6219c26a-0000-4000-8000-000000000001';
const OTRO = '6219c26a-0000-4000-8000-000000000002';

beforeAll(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-de-prueba';
});

describe('baja de avisos con un clic', () => {
  it('acepta el token de su usuario y rechaza el de otro', () => {
    const t = tokenBaja(U)!;
    expect(tokenBajaValido(U, t)).toBe(true);
    expect(tokenBajaValido(OTRO, t)).toBe(false);
  });
  it('rechaza basura sin lanzar', () => {
    expect(tokenBajaValido(U, 'x')).toBe(false);
    expect(tokenBajaValido('no-uuid', 'a'.repeat(64))).toBe(false);
    expect(tokenBajaValido(null, null)).toBe(false);
  });
  it('construye la URL', () => {
    expect(urlBaja('https://razoncomun.com/', U)).toMatch(/^https:\/\/razoncomun\.com\/baja-avisos\?u=.+&t=[0-9a-f]{64}$/);
  });
});
