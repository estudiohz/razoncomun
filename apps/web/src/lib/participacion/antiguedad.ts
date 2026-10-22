import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Antigüedad mínima como socio para el voto vinculante, tal como la ve una
 * PERSONA en la web y en los correos (22/10/2026).
 *
 * POR QUÉ EXISTE. El número vive en `settings.min_membership_days` y lo cambia
 * un admin desde `/admin/ajustes`, pero la web lo tenía ESCRITO A MANO como
 * "3 meses" en cuatro sitios (`/unete`, `/votaciones` y el correo de
 * bienvenida, dos veces). La regla real llevaba tiempo siendo otra —la
 * migración 0019 la siembra a 7 días— y los textos no se enteraban. Cada vez
 * que el admin tocaba el ajuste, la web seguía prometiendo otra cosa a quien
 * se hacía socio. Aquí se lee el valor de verdad y se redacta a partir de él.
 *
 * Es el mismo valor que sella cada votación al crearse, pero NO lo sustituye:
 * una votación ya creada conserva el suyo (`votes.min_membership_days`, I6).
 * Esto solo cuenta lo que se aplicará a las NUEVAS.
 */

/**
 * Respaldo si el ajuste no existe o está corrupto. Es el MISMO que usa el
 * disparador de la migración 0019 (`coalesce(…, 7)`): que el texto y la regla
 * real caigan siempre en el mismo valor aunque falte la fila.
 */
export const ANTIGUEDAD_POR_DEFECTO = 7;

/**
 * Lee el ajuste. `settings` tiene lectura pública (0019), así que sirve tanto
 * el cliente de una página como el de servicio de un webhook. Nunca lanza:
 * quedarse sin el dato no puede tumbar una página de captación ni un correo
 * de bienvenida, así que cae al valor por defecto.
 */
export async function leerAntiguedadMinima(supabase: SupabaseClient): Promise<number> {
  try {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'min_membership_days')
      .maybeSingle();
    const v = data?.value;
    return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 365
      ? v
      : ANTIGUEDAD_POR_DEFECTO;
  } catch {
    return ANTIGUEDAD_POR_DEFECTO;
  }
}

/** 1 → "1 día", 7 → "7 días", 30 → "1 mes", 90 → "3 meses", 365 → "1 año". */
export function describirAntiguedad(dias: number): string {
  if (dias === 1) return '1 día';
  if (dias === 365) return '1 año';
  // Los meses solo cuando es un número REDONDO de meses de 30 días: "45 días"
  // no se convierte en "1,5 meses", que suena a otra cosa.
  if (dias >= 30 && dias < 365 && dias % 30 === 0) {
    const meses = dias / 30;
    return meses === 1 ? '1 mes' : `${meses} meses`;
  }
  return `${dias} días`;
}

/**
 * La frase tal como entra en una oración: "…(a partir de 2 días de
 * antigüedad)". Con 0 días no hay antigüedad que contar, y "a partir de 0
 * días de antigüedad" suena a error, así que se dice de otra forma.
 */
export function fraseAntiguedad(dias: number): string {
  if (dias <= 0) return 'desde el primer día';
  return `a partir de ${describirAntiguedad(dias)} de antigüedad`;
}
