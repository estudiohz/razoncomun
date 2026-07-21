import { NextResponse } from 'next/server';
import { getUsuarioYPerfil } from '@/lib/auth/niveles';
import { callBrainAdmin, BrainAdminNotConfiguredError } from '@/lib/brain/serviceClient';

/**
 * Alta de una contribución ciudadana al cerebro (pieza B, cerebro-participativo.md).
 *
 * - Exige sesión: un usuario registrado. Anónimo => 401 con `needsAuth` para
 *   que el front muestre el CTA "¿Quieres aportar? Regístrate" (D-CP-4).
 * - Inserta con el cliente RLS del propio usuario: la policy
 *   `brain_contributions_insert_own` (0028) exige `author_id = auth.uid()`, así
 *   que nadie puede colar una contribución a nombre de otro.
 * - Nada toca el corpus: la fila entra como 'nueva' y se dispara el triaje IA
 *   (rc-brain-service /classify-contribution) sin bloquear la respuesta. Si el
 *   servicio no está configurado o falla, la fila queda 'nueva' y el panel
 *   admin puede reintentar el triaje (D-CP-5).
 */
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function texto(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

export async function POST(request: Request) {
  const { supabase, user } = await getUsuarioYPerfil();
  if (!user) {
    return NextResponse.json(
      { error: 'Necesitas una cuenta para aportar al cerebro.', needsAuth: true },
      { status: 401 },
    );
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const body = texto(payload.body, 4000);
  if (!body) return NextResponse.json({ error: 'Escribe tu aportación.' }, { status: 400 });

  const turnBruto = (payload.turn ?? {}) as Record<string, unknown>;
  const turn = {
    pregunta: texto(turnBruto.pregunta, 2000),
    respuesta: texto(turnBruto.respuesta, 4000),
    sources: Array.isArray(turnBruto.sources) ? turnBruto.sources.slice(0, 10) : [],
  };

  const relatedEntryId =
    typeof payload.relatedEntryId === 'string' && UUID.test(payload.relatedEntryId)
      ? payload.relatedEntryId
      : null;

  const { data, error } = await supabase
    .from('brain_contributions')
    .insert({
      author_id: user.id,
      session_id: texto(payload.sessionId, 200),
      turn,
      related_entry_id: relatedEntryId,
      body,
      claimed_wrong: texto(payload.claimedWrong, 500),
      claimed_right: texto(payload.claimedRight, 500),
      source_url: texto(payload.sourceUrl, 500),
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: `No se ha podido guardar: ${error.message}` }, { status: 500 });
  }

  // Triaje IA en segundo plano (no bloquea la respuesta al ciudadano). El
  // servidor de la web es persistente (no serverless), así que la promesa
  // termina aunque no la esperemos. Si falla, la fila queda 'nueva'.
  callBrainAdmin('/classify-contribution', { contributionId: data.id }).catch((e) => {
    if (!(e instanceof BrainAdminNotConfiguredError)) {
      console.error('[contribuciones] triaje falló:', e instanceof Error ? e.message : e);
    }
  });

  return NextResponse.json({ ok: true });
}
