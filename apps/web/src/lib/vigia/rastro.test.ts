import { describe, expect, it } from 'vitest';
import { citaElRastro, elegir, esNifPersonaFisica, expedientesDeHtml, puntuar, type ExpedienteRastro } from './rastro';

// Mismo formato que la web (devalue de Nuxt): array plano con índices.
function paginaNuxt(registros: Record<string, unknown>[]): string {
  const datos: unknown[] = [];
  const meter = (v: unknown): number => {
    const i = datos.length;
    datos.push(null);
    if (Array.isArray(v)) datos[i] = v.map(meter);
    else if (v && typeof v === 'object') datos[i] = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, meter(x)]));
    else datos[i] = v;
    return i;
  };
  meter({ data: { lista: registros } });
  return `<html><script type="application/json" id="__NUXT_DATA__">${JSON.stringify(datos)}</script></html>`;
}

const ONGD = {
  id: 'bda4b31c',
  importe: 600000,
  titulo: 'RESOLUCIÓN DE LA AECID POR LA QUE SE CONCEDE UNA SUBVENCIÓN DIRECTA A LA COORDINADORA DE ONGD ESPAÑA PARA GASTOS DE ESTRUCTURA',
  title_abbr: 'Subvención Directa Coordinadora ONGD España',
  beneficiario: 'G78416088 COORDINADORA DE ORGANIZACIONES NO GUBERNAMENTALES PARA EL DESARROLLO',
  ministerio_slug: 'exteriores',
  ministerio_nombre: 'Ministerio de Asuntos Exteriores, Unión Europea y Cooperación',
  bdns: '921565',
  fecha_concesion: '2026-07-08',
  tipo_convocatoria: 'Concesión directa - instrumental',
  fuente_url:
    'https://www.pap.hacienda.gob.es/bdnstrans/GE/es/convocatorias/921565,\nhttps://www.pap.hacienda.gob.es/bdnstrans/GE/es/concesiones/consulta?numeroConvocatoria=921565',
};
const PERU = { ...ONGD, id: 'peru1', importe: 300000, title_abbr: 'Mujeres defensoras en Perú', titulo: 'Perú violencia', beneficiario: 'G11111111 ASOCIACIÓN PERUANA' };

describe('expedientesDeHtml', () => {
  it('decodifica los expedientes del formato de Nuxt', () => {
    const [e] = expedientesDeHtml(paginaNuxt([ONGD]));
    expect(e.nif).toBe('G78416088');
    expect(e.beneficiario).toBe('COORDINADORA DE ORGANIZACIONES NO GUBERNAMENTALES PARA EL DESARROLLO');
    expect(e.importeCents).toBe(60000000);
    expect(e.bdns).toBe('921565');
    expect(e.fuentes).toHaveLength(2);
    expect(e.fuentes[0]).toMatch(/^https:\/\/www\.pap\.hacienda\.gob\.es\//);
  });
  it('devuelve vacío si la página no trae datos', () => {
    expect(expedientesDeHtml('<html></html>')).toEqual([]);
    expect(expedientesDeHtml('<script id="__NUXT_DATA__">no json</script>')).toEqual([]);
  });
});

describe('emparejar el reel con su expediente', () => {
  const exps = expedientesDeHtml(paginaNuxt([ONGD, PERU])) as ExpedienteRastro[];
  const pista = {
    importeCents: 60000000,
    organismo: 'Ministerio de Asuntos Exteriores',
    texto:
      'Exteriores reparte por muchos países… 600.000 € de cooperación internacional. Destino: España. Para pagar la programación y los gastos de estructura de la coordinadora de ONGD. Concesión directa.',
  };

  it('elige el de la Coordinadora con claridad', () => {
    const { claro, mejores } = elegir(exps.map((e) => puntuar(e, pista)));
    expect(claro?.expediente.bdns).toBe('921565');
    expect(mejores[0].señales.join(' ')).toMatch(/mismo importe/);
  });

  it('no elige nada si dos encajan casi igual', () => {
    const gemelo = { ...exps[0], id: 'otro' };
    const { claro } = elegir([exps[0], gemelo].map((e) => puntuar(e, pista)));
    expect(claro).toBeNull();
  });
});

describe('utilidades', () => {
  it('detecta la cita a la web', () => {
    expect(citaElRastro(null, 'Concesión directa. Elrastrodeldinero.com.')).toBe(true);
    expect(citaElRastro('El Rastro del Dinero lo explica')).toBe(true);
    expect(citaElRastro('otra cosa')).toBe(false);
  });
  it('distingue persona física por el NIF', () => {
    expect(esNifPersonaFisica('12345678Z')).toBe(true);
    expect(esNifPersonaFisica('X1234567L')).toBe(true);
    expect(esNifPersonaFisica('G78416088')).toBe(false);
  });
});
