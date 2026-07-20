import Link from 'next/link';
import { misBallots } from '@/lib/participacion/votes';
import { ETIQUETA_ELECCION } from '@/lib/participacion/types';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Verificación del propio voto en /perfil: confirma, con los mismos datos
 * públicos de `ballots` (D-001), que lo que se emitió es lo que quedó
 * registrado — participación en /votaciones y afiliación en rc-07.
 */
export async function MisVotos({ supabase, userId }: { supabase: SupabaseClient; userId: string }) {
  const votos = await misBallots(supabase, userId);

  if (votos.length === 0) {
    return <p className="text-[13.5px] text-gris">Todavía no has emitido ningún voto en votaciones abiertas.</p>;
  }

  return (
    <ul className="space-y-3">
      {votos.map((v) => (
        <li key={v.vote_id} className="rounded-boton border border-linea bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link
              href={`/votaciones/${v.vote_id}`}
              className="text-[14px] font-semibold text-titular underline"
            >
              {v.vote?.proposal?.title ?? 'Propuesta eliminada'}
            </Link>
            <span className="text-[12px] text-gris">
              {new Date(v.cast_at).toLocaleString('es-ES')}
            </span>
          </div>
          <p className="mt-1.5 text-[13px] text-cuerpo">
            Votaste <strong>{ETIQUETA_ELECCION[v.choice]}</strong> ·{' '}
            {v.weight === 1 ? 'voto vinculante' : 'voto consultivo'}
          </p>
        </li>
      ))}
    </ul>
  );
}
