/**
 * Presentación del número de afiliado.
 *
 * En BD se guarda el entero (0037): rellenar con ceros al guardar impediría
 * ordenar y calcular el siguiente. El relleno vive aquí, en la capa que pinta.
 *
 * Cinco dígitos y no los ocho del DNI: con ocho, el afiliado 1 sería
 * "00000001", que para un partido que arranca queda desproporcionado. Con
 * cinco caben 99.999 afiliados; si algún día se superan, el número simplemente
 * crece de ancho — nada se rompe, porque el dato real es el entero.
 */
export const DIGITOS_AFILIADO = 5;

export function formatearNumeroAfiliado(n: number | null | undefined): string | null {
  if (n == null) return null;
  return String(n).padStart(DIGITOS_AFILIADO, '0');
}

/**
 * Extrae el entero de lo que teclee alguien en el buscador: acepta "42",
 * "00042" e incluso "Afiliado 42". Devuelve null si no hay ningún número.
 */
export function numeroDesdeBusqueda(texto: string): number | null {
  const soloDigitos = texto.replace(/\D/g, '');
  if (!soloDigitos) return null;
  const n = Number(soloDigitos);
  return Number.isSafeInteger(n) ? n : null;
}
