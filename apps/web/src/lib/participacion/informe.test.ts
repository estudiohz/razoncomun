import { afterEach, describe, expect, it, vi } from 'vitest';
import { validarEnlaceInforme } from './informe';

afterEach(() => vi.unstubAllGlobals());

const responder = (...estados: number[]) => {
  const f = vi.fn();
  for (const e of estados) f.mockResolvedValueOnce({ ok: e >= 200 && e < 300, status: e });
  vi.stubGlobal('fetch', f);
  return f;
};

describe('validarEnlaceInforme', () => {
  it('acepta un enlace que responde 200', async () => {
    responder(200);
    expect(await validarEnlaceInforme('https://razoncomun.com/informes/x.pdf')).toBe('https://razoncomun.com/informes/x.pdf');
  });

  it('rechaza el 404 (el caso del PDF que nunca existió)', async () => {
    responder(404);
    await expect(validarEnlaceInforme('https://razoncomun.com/informes/test-estres-cuota-cero.pdf')).rejects.toThrow(
      /responde 404/,
    );
  });

  it('reintenta con GET si el servidor no acepta HEAD', async () => {
    const f = responder(405, 206);
    await validarEnlaceInforme('https://ejemplo.org/informe.pdf');
    expect(f).toHaveBeenCalledTimes(2);
    expect(f.mock.calls[1][1]).toMatchObject({ method: 'GET', headers: { Range: 'bytes=0-0' } });
  });

  it('rechaza http y URLs inválidas sin hacer ninguna petición', async () => {
    const f = responder(200);
    await expect(validarEnlaceInforme('http://ejemplo.org/a.pdf')).rejects.toThrow(/https/);
    await expect(validarEnlaceInforme('esto no es una url')).rejects.toThrow(/no es una URL/);
    expect(f).not.toHaveBeenCalled();
  });

  it('si no hay respuesta de red, da un mensaje entendible', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')));
    await expect(validarEnlaceInforme('https://ejemplo.org/a.pdf')).rejects.toThrow(/No se ha podido comprobar/);
  });
});
