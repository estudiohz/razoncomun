import { describe, expect, it } from 'vitest';
import { diasHasta, estadoEfectivo, plazoReclamar, plazoResolver, redactarSolicitud, sumarMeses } from './transparencia';

const base = { estado: 'presentada' as const, presentada_at: '2026-11-01', ampliada_at: null, respuesta_at: null };

describe('plazos de la Ley 19/2013', () => {
  it('suma meses respetando fin de mes', () => {
    expect(sumarMeses('2026-01-31', 1)).toBe('2026-02-28');
    expect(sumarMeses('2026-11-15', 2)).toBe('2027-01-15');
  });
  it('un mes para resolver, dos si se amplía', () => {
    expect(plazoResolver(base)).toBe('2026-12-01');
    expect(plazoResolver({ ...base, ampliada_at: '2026-11-20' })).toBe('2027-01-01');
    expect(plazoResolver({ ...base, presentada_at: null })).toBeNull();
  });
  it('pasado el plazo sin respuesta es silencio', () => {
    expect(estadoEfectivo(base, '2026-12-01')).toBe('presentada');
    expect(estadoEfectivo(base, '2026-12-02')).toBe('silencio');
    expect(estadoEfectivo({ ...base, estado: 'respondida', respuesta_at: '2026-11-20' }, '2027-03-01')).toBe('respondida');
  });
  it('un mes para reclamar al CTBG', () => {
    expect(plazoReclamar(base, '2026-12-10')).toBe('2027-01-01');
    expect(plazoReclamar({ ...base, estado: 'denegada', respuesta_at: '2026-11-20' }, '2026-11-21')).toBe('2026-12-20');
    expect(plazoReclamar(base, '2026-11-10')).toBeNull();
  });
  it('cuenta días', () => {
    expect(diasHasta('2026-12-01', '2026-11-01')).toBe(30);
  });
});

describe('redactarSolicitud', () => {
  it('incluye los datos del expediente y pide documentos concretos', () => {
    const { asunto, texto } = redactarSolicitud({
      organismo: 'Ministerio de Asuntos Exteriores',
      adjudicatario: 'COORDINADORA DE ONGD',
      adjudicatario_nif: 'G78416088',
      importe_oficial_cents: 60000000,
      fecha_adjudicacion: '2026-07-08',
      expediente: 'BDNS 921565',
      urlOficial: 'https://www.pap.hacienda.gob.es/bdnstrans/GE/es/convocatorias/921565',
    });
    expect(asunto).toContain('BDNS 921565');
    expect(texto).toContain('Ley 19/2013');
    expect(texto).toContain('G78416088');
    expect(texto).toContain('600.000,00 €');
    expect(texto).toContain('artículo 16');
  });
});
