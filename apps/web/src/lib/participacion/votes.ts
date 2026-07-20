import type { SupabaseClient } from '@supabase/supabase-js';
import type { Ballot, EleccionVoto, Propuesta, Vote } from './types';

export async function listarVotaciones(
  supabase: SupabaseClient,
): Promise<(Vote & { proposal: Propuesta | null })[]> {
  const { data, error } = await supabase
    .from('votes')
    .select('*, proposal:proposals(*)')
    .order('opens_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as (Vote & { proposal: Propuesta | null })[];
}

export async function obtenerVotacion(
  supabase: SupabaseClient,
  id: string,
): Promise<(Vote & { proposal: Propuesta | null }) | null> {
  const { data, error } = await supabase
    .from('votes')
    .select('*, proposal:proposals(*)')
    .eq('id', id)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as Vote & { proposal: Propuesta | null };
}

export function estadoVentana(vote: Vote): 'pendiente' | 'abierta' | 'cerrada' {
  const ahora = Date.now();
  const abre = new Date(vote.opens_at).getTime();
  const cierra = new Date(vote.closes_at).getTime();
  if (ahora < abre) return 'pendiente';
  if (ahora > cierra) return 'cerrada';
  return 'abierta';
}

/**
 * Elegibilidad de voto VINCULANTE calculada del lado del servidor con la
 * sesión del propio usuario (nunca con service_role, nunca fiándose de un
 * claim del JWT — C2, revision-seguridad.md). Llama a las mismas funciones
 * SQL que la política RLS de `ballots` usa para decidir (0006_votes_ballots.sql):
 * si esta función dice "sí" y la política dice "no" al insertar, algo está
 * desincronizado — pero la autoridad real siempre es la política, esto es
 * solo para pintar la UI correcta (vinculante vs consultivo) de antemano.
 */
export async function esElegibleVinculante(
  supabase: SupabaseClient,
  userId: string,
  vote: Vote,
): Promise<boolean> {
  const { data: esMiembroAntiguo } = await supabase.rpc('is_active_member_since', {
    p_user: userId,
    p_min_age: '3 months',
  });
  if (!esMiembroAntiguo) return false;

  if (vote.scope === 'manifesto') {
    const { data: esVerificado } = await supabase.rpc('is_verified', { p_user: userId });
    return Boolean(esVerificado);
  }
  return true;
}

/**
 * Mis votos emitidos, para la verificación en /perfil ("¿de verdad se
 * registró mi voto tal cual lo emití?"). Usa la misma tabla pública `ballots`
 * (D-001) filtrada por `user_id` — no hay nada que ocultar aquí porque ya es
 * pública, pero esta es la vista pensada para que el propio votante confirme
 * su emisión sin tener que bucear en la página de resultados.
 */
export async function misBallots(
  supabase: SupabaseClient,
  userId: string,
): Promise<(Ballot & { vote: (Vote & { proposal: Propuesta | null }) | null })[]> {
  const { data, error } = await supabase
    .from('ballots')
    .select('*, vote:votes(*, proposal:proposals(*))')
    .eq('user_id', userId)
    .order('cast_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as (Ballot & { vote: (Vote & { proposal: Propuesta | null }) | null })[];
}

/** Todos los votos emitidos, públicos y nominales por diseño (D-001). */
export async function listarBallotsDeVotacion(
  supabase: SupabaseClient,
  voteId: string,
): Promise<(Ballot & { display_name: string | null })[]> {
  const { data, error } = await supabase
    .from('ballots')
    .select('*, profile:profiles_public(display_name)')
    .eq('vote_id', voteId)
    .order('cast_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((fila: Record<string, unknown>) => ({
    ...(fila as unknown as Ballot),
    display_name: (fila.profile as { display_name: string | null } | null)?.display_name ?? null,
  }));
}

export interface ResultadoVotacion {
  vinculantes: number;
  consultivos: number;
  quorumAlcanzado: boolean;
  recuentoVinculante: Record<EleccionVoto, number>;
  recuentoConsultivo: Record<EleccionVoto, number>;
  proporcionFavorVinculante: number | null; // favor / (favor+contra), vinculante
  umbralSuperado: boolean | null;
}

const BASE_RECUENTO: Record<EleccionVoto, number> = { favor: 0, contra: 0, abstencion: 0 };

/**
 * Resultado publicado con participación y quórum (democracia-semidirecta.md
 * regla 6). Lectura: interpretación explícita ante ambigüedad de la spec
 * (documentada también en 0006_votes_ballots.sql) — `quorum` se trata como
 * nº mínimo de votos vinculantes válidos, y `threshold` como la fracción
 * favor/(favor+contra) exigida entre los votos vinculantes (abstenciones no
 * cuentan para el umbral, sí para la participación). A confirmar con el
 * arquitecto si la intención era otra.
 */
export function calcularResultado(vote: Vote, ballots: Ballot[]): ResultadoVotacion {
  const vinculantes = ballots.filter((b) => b.weight === 1);
  const consultivos = ballots.filter((b) => b.weight === 0);

  const recuentoVinculante = { ...BASE_RECUENTO };
  for (const b of vinculantes) recuentoVinculante[b.choice] += 1;

  const recuentoConsultivo = { ...BASE_RECUENTO };
  for (const b of consultivos) recuentoConsultivo[b.choice] += 1;

  const decisivos = recuentoVinculante.favor + recuentoVinculante.contra;
  const proporcionFavorVinculante = decisivos > 0 ? recuentoVinculante.favor / decisivos : null;

  return {
    vinculantes: vinculantes.length,
    consultivos: consultivos.length,
    quorumAlcanzado: vinculantes.length >= vote.quorum,
    recuentoVinculante,
    recuentoConsultivo,
    proporcionFavorVinculante,
    umbralSuperado:
      proporcionFavorVinculante === null ? null : proporcionFavorVinculante >= vote.threshold,
  };
}
