/**
 * Validación REAL del NIF/DNI/NIE español — no solo el formato.
 *
 * La migración `0022_tax_identities.sql` ya protege la BD con un CHECK de
 * formato (`^[0-9XYZ][0-9]{7}[A-Z]$`), pero un formato válido no implica un
 * dígito de control correcto (p.ej. "12345678A" tiene el formato correcto
 * pero la letra que le corresponde es "Z", no "A"). El encargo pide
 * explícitamente validar el dígito de control EN LA APP, antes de escribir
 * en `tax_identities` — este módulo es ese único punto de verdad.
 *
 * Algoritmo (mismo para DNI y NIE): módulo 23 sobre las 8 cifras, tabla de
 * letras estándar. El NIE traduce su letra inicial (X/Y/Z) a 0/1/2 antes de
 * aplicar la misma tabla que el DNI.
 */
const TABLA_LETRAS = 'TRWAGMYFPDXBNJZSQVHLCKE';
const PREFIJOS_NIE: Record<string, string> = { X: '0', Y: '1', Z: '2' };

/** Normaliza a mayúsculas y sin espacios — mismo criterio en cliente y servidor. */
export function normalizarNIF(valorBruto: string): string {
  return valorBruto.trim().toUpperCase().replace(/[\s-]/g, '');
}

/**
 * true si `valorBruto` es un NIF/NIE español con formato Y dígito de
 * control correctos. No distingue DNI de NIE de cara al resultado: ambos
 * son válidos como identificador fiscal para el Modelo 182.
 */
export function validarNIF(valorBruto: string): boolean {
  const valor = normalizarNIF(valorBruto);
  if (!/^[0-9XYZ][0-9]{7}[A-Z]$/.test(valor)) return false;

  const primeraLetra = valor[0];
  const numeroTexto = (PREFIJOS_NIE[primeraLetra] ?? primeraLetra) + valor.slice(1, 8);
  const numero = Number.parseInt(numeroTexto, 10);
  if (Number.isNaN(numero)) return false;

  const letraEsperada = TABLA_LETRAS[numero % 23];
  return letraEsperada === valor[8];
}
