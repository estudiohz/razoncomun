import { describe, expect, it } from 'vitest';
import { dondeSeUsaParametro, validarFormulaParametroDerivado, validarFormulaPartida } from './validacion';
import type { ParametroInput, PartidaInput } from './tipos';

const base: ParametroInput = {
  clave: 'base',
  nombre: 'Base',
  unidad: null,
  modo: 'fijo',
  formula: null,
  valor_actual: 100,
  valor_rc: null,
  es_palanca: false,
  palanca_min: null,
  palanca_max: null,
};

describe('validarFormulaPartida', () => {
  it('acepta una fórmula que solo referencia parámetros existentes', () => {
    const r = validarFormulaPartida('base * 2', [base]);
    expect(r.ok).toBe(true);
  });

  it('rechaza una fórmula con un parámetro inexistente', () => {
    const r = validarFormulaPartida('no_existe * 2', [base]);
    expect(r.ok).toBe(false);
  });
});

describe('validarFormulaParametroDerivado — detección de ciclos al guardar', () => {
  it('acepta un derivado nuevo que solo depende de parámetros existentes', () => {
    const r = validarFormulaParametroDerivado('nuevo', 'base * 1.5', [base]);
    expect(r.ok).toBe(true);
  });

  it('rechaza un ciclo directo enseñando la cadena', () => {
    const yaExiste: ParametroInput = { ...base, clave: 'y', modo: 'formula', formula: 'x + 1', valor_actual: null };
    const r = validarFormulaParametroDerivado('x', 'y + 1', [yaExiste]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/ciclo/);
  });
});

describe('dondeSeUsaParametro', () => {
  it('lista parámetros y partidas que referencian una clave, para bloquear el borrado', () => {
    const derivado: ParametroInput = {
      ...base,
      clave: 'derivado',
      nombre: 'Derivado',
      modo: 'formula',
      formula: 'base * 2',
      valor_actual: null,
    };
    const partidas: PartidaInput[] = [
      {
        id: 'p1',
        parent_id: null,
        tipo: 'ingreso',
        nombre: 'Partida 1',
        actual_modo: 'formula',
        actual_cents: null,
        actual_formula: 'base * 3',
        rc_modo: 'fijo',
        rc_cents: null,
        rc_pct: null,
        rc_formula: null,
        es_palanca: false,
        palanca_min: null,
        palanca_max: null,
      },
    ];

    const referencias = dondeSeUsaParametro('base', [base, derivado], partidas);
    expect(referencias).toEqual([
      { tipo: 'parametro', id: 'derivado', nombre: 'Derivado' },
      { tipo: 'partida_actual', id: 'p1', nombre: 'Partida 1' },
    ]);
  });

  it('devuelve lista vacía si nadie referencia la clave', () => {
    const referencias = dondeSeUsaParametro('huerfano', [base], []);
    expect(referencias).toEqual([]);
  });
});
