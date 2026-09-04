import type { SupabaseClient } from '@supabase/supabase-js';
import { crearTokenCarnet } from './token';
import { urlSitio } from '@/lib/supabase/env';

/**
 * Los datos del carnet, en un formato neutro de plataforma (D-C1).
 *
 * Esto es lo que hace que añadir Apple más adelante sea escribir un fichero y
 * no rehacer nada: el PDF y el pase de Google consumen los MISMOS campos, y el
 * futuro `apple.ts` consumirá estos y no otros.
 */
export interface DatosCarnet {
  nombre: string;
  /** Ya formateado con ceros a la izquierda: 00042. */
  numeroSocio: string;
  /** "Marzo 2026". Null si por lo que sea no consta el alta. */
  socioDesde: string | null;
  verificado: boolean;
  /** URL completa que va dentro del QR. */
  urlVerificacion: string;
}

export type MotivoSinCarnet = 'no_es_socio' | 'sin_numero' | 'dado_de_baja';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** 42 → "00042". El relleno es PRESENTACIÓN: en la BD vive el entero (0037). */
export function formatearNumeroSocio(n: number): string {
  return String(n).padStart(5, '0');
}

function mesYAnyo(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Construye el carnet de una persona, o dice por qué no lo tiene.
 *
 * Se pide con el cliente del usuario (respeta RLS): son sus propios datos.
 */
export async function cargarCarnet(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ carnet: DatosCarnet } | { motivo: MotivoSinCarnet }> {
  const { data: perfil } = await supabase
    .from('profiles')
    .select('display_name, email, member_number, level, member_since, carnet_uid, anonymized_at')
    .eq('id', userId)
    .single();

  if (!perfil) return { motivo: 'no_es_socio' };
  if (perfil.anonymized_at) return { motivo: 'dado_de_baja' };

  // La condición de socio la da `members`, no `profiles.level` — el nivel es
  // uno de tres ejes y puede ir por detrás; la fila de `members` es el espejo
  // de Stripe. `paused` cuenta: una cuota pausada de mutuo acuerdo conserva
  // los derechos (0037), así que conserva el carnet.
  const { data: miembro } = await supabase
    .from('members')
    .select('status')
    .eq('user_id', userId)
    .in('status', ['active', 'paused'])
    .maybeSingle();

  if (!miembro) return { motivo: 'no_es_socio' };

  // Se asigna en el primer cobro efectivo por trigger (0037). Que falte aquí
  // es una carrera rarísima —alta recién cobrada, trigger aún sin correr—, no
  // un estado normal: mejor no emitir un carnet sin su dato principal.
  if (perfil.member_number == null) return { motivo: 'sin_numero' };

  const token = crearTokenCarnet(perfil.carnet_uid as string);

  return {
    carnet: {
      nombre: (perfil.display_name as string | null)?.trim() || 'Socio de Razón Común',
      numeroSocio: formatearNumeroSocio(perfil.member_number as number),
      socioDesde: mesYAnyo(perfil.member_since as string | null),
      verificado: perfil.level === 'verified',
      urlVerificacion: `${urlSitio()}/carnet/v/${token}`,
    },
  };
}
