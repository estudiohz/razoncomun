import { describe, expect, it } from 'vitest';
import { generarCaptcha, verificarCaptcha } from './captcha';

function extraerRespuesta(pregunta: string): number {
  const m = /¿Cuánto es (\d+) \+ (\d+)\?/.exec(pregunta);
  if (!m) throw new Error('pregunta inesperada: ' + pregunta);
  return Number(m[1]) + Number(m[2]);
}

describe('captcha HMAC — roundtrip', () => {
  it('acierto: acepta la respuesta correcta', () => {
    const ahora = Date.now();
    const { pregunta, token } = generarCaptcha(ahora);
    const respuesta = extraerRespuesta(pregunta);
    const r = verificarCaptcha(token, respuesta, ahora + 1000);
    expect(r.ok).toBe(true);
  });

  it('respuesta incorrecta: rechaza', () => {
    const ahora = Date.now();
    const { pregunta, token } = generarCaptcha(ahora);
    const respuesta = extraerRespuesta(pregunta);
    const r = verificarCaptcha(token, respuesta + 1, ahora + 1000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/incorrecta/);
  });

  it('token expirado: rechaza pasados los 5 minutos', () => {
    const ahora = Date.now();
    const { pregunta, token } = generarCaptcha(ahora);
    const respuesta = extraerRespuesta(pregunta);
    const r = verificarCaptcha(token, respuesta, ahora + 6 * 60 * 1000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/caducado/);
  });

  it('token manipulado: rechaza si se cambia la respuesta codificada', () => {
    const ahora = Date.now();
    const { pregunta, token } = generarCaptcha(ahora);
    const respuesta = extraerRespuesta(pregunta);

    const decodificado = Buffer.from(token, 'base64url').toString('utf8');
    const [, expiraStr, firma] = decodificado.split('|');
    const tokenManipulado = Buffer.from(`${respuesta + 100}|${expiraStr}|${firma}`, 'utf8').toString(
      'base64url',
    );

    const r = verificarCaptcha(tokenManipulado, respuesta + 100, ahora + 1000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/no válido/);
  });

  it('token con firma corrupta: rechaza', () => {
    const ahora = Date.now();
    const { token } = generarCaptcha(ahora);
    const tokenCorrupto = token.slice(0, -2) + 'zz';
    const r = verificarCaptcha(tokenCorrupto, 10, ahora + 1000);
    expect(r.ok).toBe(false);
  });
});
