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
