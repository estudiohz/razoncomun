import { describe, expect, it } from 'vitest';
import { expedienteDeTitulo, itemsDeSumario, leerAnuncio, palabrasClave } from './boe';

// Recorte real del sumario del 08-07-2026 y del anuncio BOE-B-2026-23398.
const SUMARIO = {
  data: {
    sumario: {
      diario: [
        {
          seccion: [
            { codigo: '1', nombre: 'I. Disposiciones generales', departamento: [] },
            {
              codigo: '5A',
              nombre: 'V. Anuncios. - A. Contratación del Sector Público',
              departamento: {
                nombre: 'MINISTERIO DE LA PRESIDENCIA, JUSTICIA Y RELACIONES CON LAS CORTES',
                item: [
                  {
                    identificador: 'BOE-B-2026-23398',
                    titulo:
                      'Anuncio de formalización de contratos de: Junta de Contratación del Ministerio de la Presidencia. Objeto: Servicios especializados de imagen para las comparecencias y actos públicos. Expediente: SEC20250102.',
                    url_html: 'https://www.boe.es/diario_boe/txt.php?id=BOE-B-2026-23398',
                    url_xml: 'https://www.boe.es/diario_boe/xml.php?id=BOE-B-2026-23398',
                  },
                ],
              },
            },
          ],
        },
      ],
    },
  },
};

const XML = `<documento><texto><dl><dt>1. Poder adjudicador:</dt><dd><dl>
<dt>1.1) Nombre:</dt><dd>Junta de Contratación del Ministerio de la Presidencia, Justicia y Relaciones con las Cortes.</dd>
<dt>1.2) Número de identificación fiscal:</dt><dd>S2811001C.</dd></dl></dd>
<dt>10. Fecha de adjudicación:</dt><dd>9 de junio de 2026.</dd>
<dt>12. Adjudicatarios:</dt><dd><dl><dt>12.1) Nombre:</dt><dd>Baiona Steve Lacara S.L.</dd>
<dt>12.2) Número de identificación fiscal:</dt><dd>B42766436.</dd></dl></dd>
<dt>13. Valor de las ofertas:</dt><dd><dl><dt>13.1) Valor de la oferta seleccionada:</dt><dd>34.120,15 euros.</dd></dl></dd>
</dl></texto></documento>`;

describe('sumario del BOE', () => {
  it('saca los items de las secciones indexadas con órgano y expediente', () => {
    const [it] = itemsDeSumario(SUMARIO, '20260708');
    expect(it.boe_id).toBe('BOE-B-2026-23398');
    expect(it.seccion_codigo).toBe('5A');
    expect(it.published_date).toBe('2026-07-08');
    expect(it.expediente).toBe('SEC20250102');
    expect(it.departamento).toContain('PRESIDENCIA');
    expect(it.url_xml).toMatch(/xml\.php/);
  });
  it('ignora secciones que no se indexan y JSON raro', () => {
    expect(itemsDeSumario({}, '20260708')).toEqual([]);
    expect(expedienteDeTitulo('Sin expediente')).toBeNull();
  });
});

describe('anuncio de formalización', () => {
  it('lee órgano, adjudicatario, NIF, importe y fecha', () => {
    const a = leerAnuncio(XML);
    expect(a.organoNif).toBe('S2811001C');
    expect(a.adjudicatario).toBe('Baiona Steve Lacara S.L');
    expect(a.adjudicatarioNif).toBe('B42766436');
    expect(a.importeCents).toBe(3412015);
    expect(a.fechaAdjudicacion).toBe('2026-06-09');
  });
});

describe('palabrasClave', () => {
  it('quita las genéricas y prioriza las repetidas', () => {
    expect(palabrasClave('Contrato de servicios de peluquería y maquillaje para comparecencias; peluquería')).toEqual([
      'peluqueria',
      'comparecencias',
      'maquillaje',
    ]);
  });
});
