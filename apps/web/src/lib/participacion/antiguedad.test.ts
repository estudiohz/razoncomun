import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ANTIGUEDAD_POR_DEFECTO,
  describirAntiguedad,
  fraseAntiguedad,
  leerAntiguedadMinima,
} from './antiguedad';

/** Un cliente de mentira que devuelve lo que se le diga, o lanza. */
function cliente(respuesta: { data?: unknown; lanza?: boolean }): SupabaseClient {
  const cadena = {
    select: () => cadena,
    eq: () => cadena,
    maybeSingle: async () => {
      if (respuesta.lanza) throw new Error('red caída');
      return { data: respuesta.data ?? null, error: null };
    },
  };
  return { from: () => cadena } as unknown as SupabaseClient;
}

describe('describirAntiguedad', () => {
  it('días sueltos', () => {
    expect(describirAntiguedad(2)).toBe('2 días');
    expect(describirAntiguedad(7)).toBe('7 días');
    expect(describirAntiguedad(45)).toBe('45 días');
  });

  it('el singular de 1 día', () => {
    expect(describirAntiguedad(1)).toBe('1 día');
  });

  it('meses solo cuando son un número redondo de meses', () => {
    expect(describirAntiguedad(30)).toBe('1 mes');
    expect(describirAntiguedad(90)).toBe('3 meses');
    expect(describirAntiguedad(180)).toBe('6 meses');
    // 45 días NO se convierte en "1,5 meses"
    expect(describirAntiguedad(45)).toBe('45 días');
    expect(describirAntiguedad(21)).toBe('21 días');
  });

  it('un año', () => {
    expect(describirAntiguedad(365)).toBe('1 año');
  });
});

describe('fraseAntiguedad', () => {
  it('entra en una oración', () => {
    expect(fraseAntiguedad(2)).toBe('a partir de 2 días de antigüedad');
    expect(fraseAntiguedad(90)).toBe('a partir de 3 meses de antigüedad');
  });

  it('con 0 días no dice "a partir de 0 días"', () => {
    expect(fraseAntiguedad(0)).toBe('desde el primer día');
  });
});

describe('leerAntiguedadMinima', () => {
  it('lee el valor del ajuste', async () => {
    expect(await leerAntiguedadMinima(cliente({ data: { value: 2 } }))).toBe(2);
    expect(await leerAntiguedadMinima(cliente({ data: { value: 0 } }))).toBe(0);
  });

  it('cae al valor por defecto —el mismo que el disparador de la BD— si falta la fila', async () => {
    expect(ANTIGUEDAD_POR_DEFECTO).toBe(7);
    expect(await leerAntiguedadMinima(cliente({ data: null }))).toBe(7);
  });

  it('cae al valor por defecto si el valor está corrupto', async () => {
    for (const malo of ['dos', 2.5, -1, 366, null, {}]) {
      expect(await leerAntiguedadMinima(cliente({ data: { value: malo } }))).toBe(7);
    }
  });

  it('nunca lanza: una caída no puede tumbar la página ni el correo', async () => {
    expect(await leerAntiguedadMinima(cliente({ lanza: true }))).toBe(7);
  });
});
