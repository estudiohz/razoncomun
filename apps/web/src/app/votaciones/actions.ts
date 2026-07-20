'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { emitirVoto } from '@/lib/participacion/ballots';
import { esElegibleVinculante, obtenerVotacion, estadoVentana } from '@/lib/participacion/votes';
import type { EleccionVoto } from '@/lib/participacion/types';

export interface ResultadoEmision {
  ok: boolean;
  mensaje: string;
}

/**
 * Emite el voto del usuario actual. La UI debe haber mostrado el aviso D-001
 * ("tu voto será público con tu nombre") y recogido `confirmado` marcado —
 * esta función lo exige explícitamente (ver lib/participacion/ballots.ts).
 *
 * El peso (vinculante=1 / consultivo=0) se decide aquí en el servidor con la
 * MISMA función que consulta BD que usa la política RLS de `ballots`
 * (esElegibleVinculante → is_active_member_since / is_verified) — nunca con
 * un claim del cliente. Si por lo que sea esto y la política RLS discreparan,
 * la autoridad real sigue siendo la política: el INSERT sencillamente sería
 * rechazado con 403.
 */
export async function emitirVotoAction(
  voteId: string,
  choice: EleccionVoto,
  confirmado: boolean,
): Promise<ResultadoEmision> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/entrar?next=/votaciones/${voteId}`);

  if (!confirmado) {
    return { ok: false, mensaje: 'Debes confirmar que entiendes que tu voto será público con tu nombre.' };
  }

  const votacion = await obtenerVotacion(supabase, voteId);
  if (!votacion) return { ok: false, mensaje: 'Esta votación no existe.' };
  if (estadoVentana(votacion) !== 'abierta') {
    return { ok: false, mensaje: 'Esta votación no está abierta ahora mismo.' };
  }

  const vinculante = await esElegibleVinculante(supabase, user.id, votacion);

  const resultado = await emitirVoto(supabase, {
    voteId,
    userId: user.id,
    choice,
    weight: vinculante ? 1 : 0,
    confirmacionPublica: true,
  });

  revalidatePath(`/votaciones/${voteId}`);
  revalidatePath('/perfil');

  if (!resultado.ok) {
    if (resultado.status === 409) {
      return { ok: false, mensaje: 'Ya has emitido tu voto en esta votación. No se puede cambiar (censo congelado).' };
    }
    if (resultado.status === 403) {
      return {
        ok: false,
        mensaje: 'La base de datos ha rechazado tu voto: no cumples los requisitos de elegibilidad en este momento.',
      };
    }
    return { ok: false, mensaje: `No se pudo registrar el voto: ${resultado.error}` };
  }

  return { ok: true, mensaje: vinculante ? 'Voto vinculante registrado.' : 'Voto consultivo registrado.' };
}
