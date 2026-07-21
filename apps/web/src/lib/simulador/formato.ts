/** Conversión euros ↔ céntimos (D-S4) y formato para el admin de `/admin/presupuesto`. */

export function centsAEuros(cents: number | null | undefined): number | null {
  if (cents === null || cents === undefined) return null;
  return cents / 100;
}

export function eurosACents(euros: number | null | undefined): number | null {
  if (euros === null || euros === undefined || Number.isNaN(euros)) return null;
  return Math.round(euros * 100);
}

export function formatoEuros(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—';
  // `useGrouping: 'always'`: el default de Intl.NumberFormat cambió a
  // `useGrouping: 'auto'` (ECMA-402), y con la CLDR de es-ES esa opción NO
  // agrupa números de 4 cifras («1100 €» en vez de «1.100 €») aunque sí
  // agrupa desde 5 cifras — verificado en Node 24 / ICU 77. Forzar 'always'
  // hace el agrupado consistente en cualquier magnitud.
  return (cents / 100).toLocaleString('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
    useGrouping: 'always',
  });
}

export function formatoEurosPreciso(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—';
  return (cents / 100).toLocaleString('es-ES', {
    style: 'currency',
    currency: 'EUR',
    useGrouping: 'always',
  });
}

/**
 * Formato corto para `/pais` (panel público — refinamiento visual pedido
 * por Sergio viendo el panel en vivo, 21/07/2026): a partir de 1.000.000 €
 * se abrevia en millones ("150.000 Mill. €" en vez de "150.000.000.000 €"),
 * que es ilegible de un vistazo con las cifras del Estado. Por debajo del
 * millón se usa `formatoEuros` tal cual (una partida menor no gana nada
 * abreviándose y perdería precisión visual).
 *
 * El admin (`AreaEditorClient`, `TableroClient`, editor de parámetros)
 * SIGUE usando `formatoEuros`/`formatoEurosPreciso` sin cambios — quien
 * rellena cifras necesita precisión exacta, no un resumen.
 */
export function formatoCorto(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—';
  if (Math.abs(cents) >= 100_000_000) {
    // 100.000.000 cents = 1.000.000 €. El signo lo pone `toLocaleString`
    // solo (número negativo → "-16.100"), no hace falta tratarlo aparte.
    const millones = cents / 100_000_000;
    return `${millones.toLocaleString('es-ES', { maximumFractionDigits: 0, useGrouping: 'always' })} Mill. €`;
  }
  return formatoEuros(cents);
}

/**
 * Formato de personas para `sim_demografia` (ola S3.1,
 * docs/tecnico/simulador-pais.md §9). Misma lección de `formatoEuros`: el
 * default `useGrouping: 'auto'` de `Intl.NumberFormat` NO agrupa números de
 * 4 cifras en `es-ES` en el Node/ICU de este entorno (commit `21dc4f7`) —
 * `'always'` explícito es obligatorio en CUALQUIER formateador de número
 * nuevo, no solo en el de euros.
 */
export function formatoPersonas(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return `${n.toLocaleString('es-ES', { maximumFractionDigits: 0, useGrouping: 'always' })} personas`;
}

/**
 * Notación abreviada ("8M" en vez de "8.000.000 personas") — pedida por
 * Sergio para las tarjetas de "Población de España": con varias tarjetas por
 * fila, el número completo con miles no cabe/lee bien. Mismo umbral y misma
 * lección de `useGrouping: 'always'` que `formatoCorto` (euros).
 */
export function formatoPersonasCorto(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  if (Math.abs(n) >= 1_000_000) {
    const millones = n / 1_000_000;
    return `${millones.toLocaleString('es-ES', { maximumFractionDigits: 1, useGrouping: 'always' })}M`;
  }
  if (Math.abs(n) >= 1_000) {
    const miles = n / 1_000;
    return `${miles.toLocaleString('es-ES', { maximumFractionDigits: 1, useGrouping: 'always' })}K`;
  }
  return n.toLocaleString('es-ES', { maximumFractionDigits: 0, useGrouping: 'always' });
}

/**
 * Combina un importe en céntimos con una unidad tipo "€/mes" sin duplicar
 * el símbolo € (`formatoEuros` ya añade uno). Si la unidad empieza por "€"
 * (caso normal en `sim_demografia.unidad_valor_medio`), se pega el resto de
 * la unidad justo tras el símbolo que ya puso `formatoEuros`
 * (`formatoEurosConUnidad(140000, '€/mes')` → "1.400 €/mes", nunca
 * "1.400 € €/mes"). Con una unidad que no empieza por "€", se separa con un
 * espacio normal.
 */
export function formatoEurosConUnidad(cents: number | null | undefined, unidad: string | null | undefined): string {
  const base = formatoEuros(cents);
  if (base === '—' || !unidad?.trim()) return base;
  const u = unidad.trim();
  return u.startsWith('€') ? `${base}${u.slice(1)}` : `${base} ${u}`;
}
