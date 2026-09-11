import { describe, expect, it } from 'vitest';
import { generarCarnetPdf } from './pdf';
import type { DatosCarnet } from './modelo';

const BASE: DatosCarnet = {
  nombre: 'Sergio Martínez Ruiz',
  numeroSocio: '00042',
  socioDesde: 'Marzo 2026',
  verificado: false,
  urlVerificacion: 'https://razoncomun.com/carnet/v/3f2a1b8c-5d6e-4f70-9a1b-2c3d4e5f6071.abc',
};

describe('carnet en PDF', () => {
  it('sale un PDF válido', async () => {
    const pdf = await generarCarnetPdf(BASE);
    expect(Buffer.from(pdf.slice(0, 5)).toString()).toBe('%PDF-');
    expect(pdf.byteLength).toBeGreaterThan(2000);
  });

  it('el verificado pesa más que el normal: lleva sello y una línea de texto extra', async () => {
    const normal = await generarCarnetPdf(BASE);
    const verificado = await generarCarnetPdf({ ...BASE, verificado: true });
    expect(verificado.byteLength).toBeGreaterThan(normal.byteLength);
  });

  it('aguanta un nombre larguísimo sin reventar', async () => {
    const pdf = await generarCarnetPdf({
      ...BASE,
      nombre: 'María del Carmen de la Santísima Trinidad Fernández de Córdoba y Villalobos',
    });
    expect(pdf.byteLength).toBeGreaterThan(2000);
  });

  it('aguanta sin fecha de alta', async () => {
    const pdf = await generarCarnetPdf({ ...BASE, socioDesde: null });
    expect(pdf.byteLength).toBeGreaterThan(2000);
  });

  // El nombre NO puede acabar en los metadatos: un PDF se comparte y sus
  // propiedades se leen sin abrirlo.
  it('no filtra el nombre en los metadatos', async () => {
    const pdf = await generarCarnetPdf(BASE);
    const crudo = Buffer.from(pdf).toString('latin1');
    expect(crudo).not.toContain('Sergio Mart');
  });
});
