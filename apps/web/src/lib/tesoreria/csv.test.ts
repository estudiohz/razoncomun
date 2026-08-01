import { describe, it, expect } from 'vitest';
import { leerExtracto } from './csv';

/**
 * Tests puros del lector de extractos (T3). Sin red ni BD: solo el parseo, que
 * es donde están los casos raros de verdad. Cada caso viene de una forma real
 * en que los bancos españoles (o Excel) exportan.
 */
describe('leerExtracto()', () => {
  it('lee el formato típico español: punto y coma, fecha dd/mm/aaaa y decimales con coma', () => {
    const { filas, errores } = leerExtracto(
      ['Fecha;Concepto;Importe', '15/07/2026;Cuota socio;15,00', '16/07/2026;Dominio web;-12,10'].join('\n'),
    );
    expect(errores).toHaveLength(0);
    expect(filas).toHaveLength(2);
    expect(filas[0]).toMatchObject({ dated: '2026-07-15', amount_cents: 1500, direction: 'in' });
    expect(filas[1]).toMatchObject({ dated: '2026-07-16', amount_cents: 1210, direction: 'out' });
  });

  it('distingue el separador de millares del decimal en ambos formatos', () => {
    const { filas } = leerExtracto(
      ['Fecha,Concepto,Importe', '2026-07-15,Donación,"1.234,56"', '2026-07-16,Subvención,"1,234.56"'].join('\n'),
    );
    expect(filas[0].amount_cents).toBe(123456);
    expect(filas[1].amount_cents).toBe(123456);
  });

  it('respeta las comas dentro de campos entrecomillados', () => {
    const { filas } = leerExtracto(
      ['Fecha,Concepto,Importe', '2026-07-15,"Pago a Imprenta, S.L.",-50,00'].join('\n'),
    );
    expect(filas[0].description).toBe('Pago a Imprenta, S.L.');
  });

  it('admite columnas separadas de debe y haber', () => {
    const { filas } = leerExtracto(
      ['Fecha;Concepto;Cargo;Abono', '15/07/2026;Cuota;;15,00', '16/07/2026;Hosting;9,90;'].join('\n'),
    );
    expect(filas[0]).toMatchObject({ direction: 'in', amount_cents: 1500 });
    expect(filas[1]).toMatchObject({ direction: 'out', amount_cents: 990 });
  });

  it('reconoce cabeceras en inglés y captura la contraparte', () => {
    const { filas } = leerExtracto(
      ['Date,Description,Amount,Payee', '2026-07-15,Membership,15.00,Ana García'].join('\n'),
    );
    expect(filas[0].counterparty_name).toBe('Ana García');
    expect(filas[0].amount_cents).toBe(1500);
  });

  it('ignora el BOM que Excel añade al guardar como CSV UTF-8', () => {
    const { filas, errores } = leerExtracto('﻿Fecha;Concepto;Importe\n15/07/2026;Cuota;15,00');
    expect(errores).toHaveLength(0);
    expect(filas).toHaveLength(1);
  });

  it('salta las líneas ilegibles pero conserva el resto, diciendo cuáles fallaron', () => {
    const { filas, errores } = leerExtracto(
      ['Fecha;Concepto;Importe', 'sin-fecha;Algo;10,00', '15/07/2026;Cuota;15,00', '16/07/2026;Vacío;'].join('\n'),
    );
    expect(filas).toHaveLength(1);
    expect(errores.map((e) => e.linea)).toEqual([2, 4]);
  });

  it('avisa con las cabeceras leídas cuando no encuentra la columna de importe', () => {
    const { filas, errores } = leerExtracto('Fecha;Concepto\n15/07/2026;Cuota');
    expect(filas).toHaveLength(0);
    expect(errores[0].motivo).toContain('importe');
    expect(errores[0].motivo).toContain('Concepto');
  });
});
