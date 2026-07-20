import type { SupabaseClient } from '@supabase/supabase-js';
import type { EleccionVoto } from './types';

/**
 * Escritura del voto — aislada en su propio módulo a propósito (petición
 * explícita del brief de rc-06) porque es la operación más sensible de todo
 * el módulo de Participación:
 *
 * - D-001 (decisiones-construccion.md): el voto es PÚBLICO NOMINAL. Esta
 *   función NO debe llamarse nunca sin que la capa de UI/Server Action haya
 *   mostrado antes el aviso imborrable ("Tu voto será público con tu
 *   nombre") y haya recogido una confirmación explícita — por eso exige
 *   `confirmacionPublica: true` como parámetro obligatorio, no opcional, y
 *   lanza si no viene marcado. No es una comprobación de seguridad (esa la
 *   hace RLS), es un cortafuegos de producto para que ningún futuro caller
 *   se salte el aviso por error.
 * - La elegibilidad REAL a voto vinculante (weight=1) la decide la política
 *   RLS `ballots_insert_self_eligible` (0006_votes_ballots.sql) contra BD en
 *   el momento del INSERT (C2) — esta función no evalúa nada, solo inserta
 *   con los valores que le pasan y deja que la BD acepte o rechace (403).
 * - `ballots` es de solo INSERT: ni siquiera admin puede editar/borrar un
 *   voto emitido (censo congelado, integridad del resultado).
 */
export async function emitirVoto(
  supabase: SupabaseClient,
  params: {
    voteId: string;
    userId: string;
    choice: EleccionVoto;
    weight: 0 | 1;
    confirmacionPublica: true;
  },
): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  if (params.confirmacionPublica !== true) {
    throw new Error(
      'emitirVoto: falta confirmacionPublica. El aviso D-001 ("tu voto será público con tu ' +
        'nombre") debe mostrarse y confirmarse ANTES de llamar a esta función.',
    );
  }

  const { error, status } = await supabase.from('ballots').insert({
    vote_id: params.voteId,
    user_id: params.userId,
    choice: params.choice,
    weight: params.weight,
  });

  if (error) {
    return { ok: false, error: error.message, status };
  }
  return { ok: true };
}
