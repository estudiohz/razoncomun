/**
 * apps/web/src/lib/tienda/precios.ts
 *
 * Formateo de importes de la tienda. `useGrouping: 'always'` explícito —
 * lección ya pagada en el simulador (commit 21dc4f7): el default 'auto' de
 * Intl.NumberFormat NO agrupa los números de 4 cifras en es-ES en el
 * Node/ICU de este entorno, así que 1.000 € se pintaría como "1000 €".
 */

const EUR = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: 'always',
});

/** 2700 -> "27,00 €" */
export function formatoPrecio(cents: number): string {
  return EUR.format((Number.isFinite(cents) ? cents : 0) / 100);
}

/** Suma de líneas ya resueltas contra el catálogo (nunca con precios del cliente, D-T3). */
export function subtotalCents(lineas: { precioCents: number; cantidad: number }[]): number {
  return lineas.reduce((suma, l) => suma + l.precioCents * l.cantidad, 0);
}
