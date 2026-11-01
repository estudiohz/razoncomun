import { describe, expect, it } from 'vitest';
import { aConcesion, consultasDeTexto, puntuarConcesion } from './bdns';

// Registro real de la API (BDNS 921565), recortado.
const REGISTRO = {
  codConcesion: 'SB155976907',
  fechaConcesion: '2026-07-08',
  beneficiario: 'G78416088 COORDINADORA DE ORGANIZACIONES NO GUBERNAMENTALES PARA EL DESARROLLO          ',
  instrumento: 'SUBVENCIÓN y ENTREGA DINERARIA SIN CONTRAPRESTACIÓN ',
  importe: 600000,
  urlBR: 'https://www.boe.es/eli/es/o/2022/04/06/auc286',
  numeroConvocatoria: '921565',
  convocatoria: 'RESOLUCIÓN DE LA DIRECCIÓN DE LA AECID POR LA QUE SE CONCEDE UNA SUBVENCIÓN DIRECTA A LA COORDINADORA DE ONGD ESPAÑA',
  nivel2: 'MINISTERIO DE ASUNTOS EXTERIORES, UNIÓN EUROPEA Y COOPERACIÓN',
  nivel3: 'AGENCIA ESTATAL AGENCIA ESPAÑOLA DE COOPERACIÓN INTERNACIONAL PARA EL DESARROLLO',
};

describe('aConcesion', () => {
  it('separa NIF y nombre y construye los enlaces oficiales', () => {
    const c = aConcesion(REGISTRO)!;
    expect(c.nif).toBe('G78416088');
    expect(c.beneficiario).toBe('COORDINADORA DE ORGANIZACIONES NO GUBERNAMENTALES PARA EL DESARROLLO');
    expect(c.importeCents).toBe(60000000);
    expect(c.urlConvocatoria).toBe('https://www.pap.hacienda.gob.es/bdnstrans/GE/es/convocatorias/921565');
    expect(c.urlBases).toMatch(/^https:\/\/www\.boe\.es\//);
    expect(c.organo).toContain('ASUNTOS EXTERIORES');
  });
  it('descarta registros incompletos', () => {
    expect(aConcesion({ importe: 1 })).toBeNull();
  });
});

describe('puntuarConcesion', () => {
  const c = aConcesion(REGISTRO)!;
  it('NIF e importe iguales dan un emparejamiento seguro', () => {
    const r = puntuarConcesion(c, { nif: 'g78416088', beneficiario: null, importeCents: 60000000, organismo: null, texto: '' });
    expect(r.score).toBeGreaterThanOrEqual(0.8);
    expect(r.señales).toEqual(expect.arrayContaining(['mismo NIF', 'mismo importe']));
  });
  it('sin NIF, importe y texto bastan', () => {
    const r = puntuarConcesion(c, {
      nif: null,
      beneficiario: 'Coordinadora de ONGD',
      importeCents: 60000000,
      organismo: 'Ministerio de Asuntos Exteriores',
      texto: 'gastos de estructura de la coordinadora de ONGD España, concesión directa',
    });
    expect(r.score).toBeGreaterThanOrEqual(0.6);
  });
});

describe('consultasDeTexto', () => {
  it('usa el nombre del beneficiario sin la forma jurídica', () => {
    expect(consultasDeTexto({ nif: null, beneficiario: 'Acme Consultores, S.L.', importeCents: null, organismo: null, texto: '' })).toEqual([
      'Acme Consultores',
    ]);
  });
  it('no busca con nombres de una sola palabra', () => {
    expect(consultasDeTexto({ nif: null, beneficiario: 'Acme', importeCents: null, organismo: null, texto: '' })).toEqual([]);
  });
});
