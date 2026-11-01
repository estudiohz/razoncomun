import { describe, expect, it } from 'vitest';
import { aConcesion, agruparConcesiones, consultasDeTexto, puntuarConcesion } from './bdns';

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

// Caso real (02-11-2026): BDNS 922812, dos concesiones a MIPY que suman los
// 150.000 € del reel. Antes se elegía la de 3.400 € como principal.
const MIPY = (cod: string, importe: number) => ({
  codConcesion: cod,
  fechaConcesion: '2026-07-31',
  beneficiario: '000801394899 ASOCIACIÓN ARTICULACIÓN DE MUJERES INDÍGENAS DEL PARAGUAY (MIPY)',
  importe,
  numeroConvocatoria: '922812',
  convocatoria: 'Subvención directa Mujeres Indígenas Paraguay',
  nivel2: 'MINISTERIO DE ASUNTOS EXTERIORES, UNIÓN EUROPEA Y COOPERACIÓN',
});

describe('varias concesiones, un solo caso', () => {
  const lista = [aConcesion(MIPY('SB157670369', 3400))!, aConcesion(MIPY('SB157670368', 146600))!];

  it('separa el identificador extranjero del nombre', () => {
    expect(lista[0].nif).toBe('000801394899');
    expect(lista[0].beneficiario).toBe('ASOCIACIÓN ARTICULACIÓN DE MUJERES INDÍGENAS DEL PARAGUAY (MIPY)');
  });

  it('suma las del mismo beneficiario en la misma convocatoria', () => {
    const [g, ...resto] = agruparConcesiones(lista);
    expect(resto).toHaveLength(0);
    expect(g.importeCents).toBe(15000000);
    expect(g.numConcesiones).toBe(2);
    expect(g.codConcesion).toBe('SB157670368 + SB157670369');
  });

  it('el grupo encaja con el importe del reel', () => {
    const [g] = agruparConcesiones(lista);
    const r = puntuarConcesion(g, {
      nif: null,
      beneficiario: 'Mujeres Indígenas en acción',
      importeCents: 15000000,
      organismo: null,
      texto: 'Paraguay, 150000 €. Mujeres Indígenas en acción. Dos concesiones, un solo título',
    });
    expect(r.señales).toContain('mismo importe');
    expect(r.score).toBeGreaterThanOrEqual(0.5); // sin NIF ni código no es «claro»: lo confirma el auditor
  });
});

describe('doble registro en la BDNS', () => {
  // Caso real BDNS 921565: la misma concesión de 600.000 € registrada dos veces.
  const reg = (cod: string, fecha: string) => aConcesion({ ...REGISTRO, codConcesion: cod, fechaConcesion: fecha })!;

  it('no suma dos registros con el mismo importe', () => {
    const [g] = agruparConcesiones([reg('SB155976907', '2026-07-08'), reg('SB155723294', '2026-07-07')]);
    expect(g.importeCents).toBe(60000000);
    expect(g.numConcesiones).toBe(1);
    expect(g.duplicados).toBe(1);
    expect(g.codConcesion).toBe('SB155723294 + SB155976907');
  });
});
