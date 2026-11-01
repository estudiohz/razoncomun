import { describe, expect, it } from 'vitest';
import { columnasDesdeExtraccion, confianzas, lenguajeDeRiesgo } from './extraccion';

const ejemplo = {
  titulo: 'Ministerio X adjudica 1,2 M€ a Acme',
  organismo: { value: 'Ministerio X', confidence: 0.92 },
  organismo_nivel: { value: 'estatal', confidence: 0.9 },
  adjudicatario: { value: 'Acme, S.L.', confidence: 0.85 },
  nif: { value: 'b-12345678', confidence: 0.4 },
  importe_cents: { value: 120000000, confidence: 0.95 },
  fecha: { value: '2026-06-01', confidence: 0.5 },
  expediente: { value: '2026/000123', confidence: 0.6 },
  categoria: { value: 'consultoria', confidence: 0.8 },
  adjudicatario_es_persona_fisica: false,
  resumen_hechos: 'El reel afirma que el Ministerio X adjudicó un contrato a Acme.',
  afirmaciones_a_verificar: ['Importe de 1,2 M€', 'Contrato menor'],
  lenguaje_de_riesgo_detectado: ['robo'],
};

describe('columnasDesdeExtraccion', () => {
  it('mapea y normaliza los campos', () => {
    const c = columnasDesdeExtraccion(ejemplo);
    expect(c.organismo).toBe('Ministerio X');
    expect(c.organismo_nivel).toBe('estatal');
    expect(c.adjudicatario_nif).toBe('B12345678');
    expect(c.importe_denunciado_cents).toBe(120000000);
    expect(c.fecha_adjudicacion).toBe('2026-06-01');
    expect(c.categoria).toBe('consultoria');
    expect(c.title).toBe('Ministerio X adjudica 1,2 M€ a Acme');
    expect(c.hechos_html).toContain('Afirmaciones a comprobar');
  });

  it('descarta lo que no encaja en lugar de guardarlo', () => {
    const c = columnasDesdeExtraccion({
      organismo_nivel: { value: 'galáctico', confidence: 1 },
      categoria: { value: '<script>', confidence: 1 },
      importe_cents: { value: 'mucho', confidence: 1 },
      fecha: { value: '2026-13-45', confidence: 1 },
    });
    expect(c.organismo_nivel).toBeNull();
    expect(c.categoria).toBeNull();
    expect(c.importe_denunciado_cents).toBeNull();
    expect(c.fecha_adjudicacion).toBeNull();
  });

  it('aguanta basura sin romper', () => {
    expect(() => columnasDesdeExtraccion(null)).not.toThrow();
    expect(() => columnasDesdeExtraccion('texto')).not.toThrow();
  });
});

describe('confianzas y lenguaje de riesgo', () => {
  it('solo da confianza de los campos con valor', () => {
    expect(confianzas({ ...ejemplo, organismo: { value: null, confidence: 0.9 } })).not.toHaveProperty('organismo');
    expect(confianzas(ejemplo).nif).toBe(0.4);
  });
  it('lista los términos de riesgo', () => {
    expect(lenguajeDeRiesgo(ejemplo)).toEqual(['robo']);
    expect(lenguajeDeRiesgo({})).toEqual([]);
  });
});
