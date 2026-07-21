import { describe, expect, it } from 'vitest';
import { evaluar, extraerIdentificadores } from './evaluador';

describe('evaluador — fórmula válida', () => {
  it('evalúa una expresión con parámetros, paréntesis y precedencia', () => {
    const r = evaluar('(a + b) * 2 - c / 2', { a: 3, b: 5, c: 10 });
    expect(r).toEqual({ ok: true, valor: 11 }); // (3+5)*2 - 10/2 = 16 - 5 = 11
  });

  it('acepta decimales y números enteros', () => {
    const r = evaluar('num_autonomos_base * cuota_media_autonomo', {
      num_autonomos_base: 3300000,
      cuota_media_autonomo: 2.5,
    });
    expect(r).toEqual({ ok: true, valor: 8250000 });
  });

  it('soporta el menos unario', () => {
    const r = evaluar('-cuota + 10', { cuota: 4 });
    expect(r).toEqual({ ok: true, valor: 6 });
  });
});

describe('evaluador — división por cero', () => {
  it('rechaza x/0 explícito', () => {
    const r = evaluar('a / b', { a: 10, b: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/división por cero/);
  });

  it('rechaza cuando el denominador se calcula a 0', () => {
    const r = evaluar('a / (b - b)', { a: 10, b: 5 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/división por cero/);
  });
});

describe('evaluador — parámetro desconocido', () => {
  it('rechaza un identificador que no está en el mapa de valores', () => {
    const r = evaluar('num_autonomos * cuota_media_autonomo', { num_autonomos: 100 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/parámetro desconocido: cuota_media_autonomo/);
  });
});

describe('evaluador — nunca propaga NaN/Infinity', () => {
  it('rechaza si un valor de entrada ya es NaN', () => {
    const r = evaluar('a + 1', { a: NaN });
    expect(r.ok).toBe(false);
  });

  it('rechaza si un valor de entrada es Infinity', () => {
    const r = evaluar('a + 1', { a: Infinity });
    expect(r.ok).toBe(false);
  });
});

describe('evaluador — contrato de longitud y gramática (D-S8, adversario)', () => {
  it('rechaza una fórmula de más de 300 caracteres', () => {
    const larga = Array.from({ length: 301 }, () => '1').join('+');
    expect(larga.length).toBeGreaterThan(300);
    const r = evaluar(larga, {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/demasiado larga/);
  });

  it('rechaza intentos de inyección tipo eval/Function', () => {
    for (const intento of [
      'constructor.constructor("return process")()',
      'a; DROP TABLE sim_parametros;',
      '__proto__',
      'a ** 2',
      'Math.pow(a,2)',
      'a || alert(1)',
    ]) {
      const r = evaluar(intento, { a: 1 });
      expect(r.ok).toBe(false);
    }
  });

  it('rechaza identificadores con mayúsculas o unicode', () => {
    expect(evaluar('A + 1', { A: 1 }).ok).toBe(false);
    expect(evaluar('á + 1', { á: 1 } as Record<string, number>).ok).toBe(false);
  });

  it('rechaza una llamada de función disfrazada de identificador', () => {
    const r = evaluar('abs(a)', { a: -5, abs: 999 });
    expect(r.ok).toBe(false);
  });

  it('rechaza paréntesis sin cerrar y expresiones vacías', () => {
    expect(evaluar('(a + 1', { a: 1 }).ok).toBe(false);
    expect(evaluar('', {}).ok).toBe(false);
    expect(evaluar('()', {}).ok).toBe(false);
  });
});

describe('extraerIdentificadores', () => {
  it('devuelve las claves referenciadas sin duplicados, en orden de aparición', () => {
    const r = extraerIdentificadores('a * (b + a) - c');
    expect(r).toEqual({ ok: true, identificadores: ['a', 'b', 'c'] });
  });

  it('propaga el error de sintaxis si la fórmula es inválida', () => {
    const r = extraerIdentificadores('a + $');
    expect(r.ok).toBe(false);
  });
});
