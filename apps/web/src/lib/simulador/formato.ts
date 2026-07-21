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
  return (cents / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

export function formatoEurosPreciso(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—';
  return (cents / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
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
    return `${millones.toLocaleString('es-ES', { maximumFractionDigits: 0 })} Mill. €`;
  }
  return formatoEuros(cents);
}
