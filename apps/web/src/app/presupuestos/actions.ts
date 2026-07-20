'use server';

import { createClient } from '@/lib/supabase/server';
import { guardarEscenario } from '@/lib/participacion/budget';
import { hashAnonimo, obtenerOCrearAnonId } from '@/lib/participacion/anon';

export interface ResultadoEscenario {
  ok: boolean;
  id?: string;
  mensaje: string;
}

/** Guarda "mi presupuesto" — funciona logueado o anónimo (budget_scenarios_insert_any). */
export async function guardarEscenarioAction(allocation: Record<string, number>): Promise<ResultadoEscenario> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let anonHash: string | null = null;
  if (!user) {
    const anonId = await obtenerOCrearAnonId();
    anonHash = hashAnonimo('presupuesto-simulador', anonId);
  }

  try {
    const id = await guardarEscenario(supabase, {
      allocation,
      userId: user?.id ?? null,
      anonHash: user ? null : anonHash,
    });
    return { ok: true, id, mensaje: 'Escenario guardado. Aquí tienes tu tarjeta para compartir.' };
  } catch {
    return { ok: false, mensaje: 'No se pudo guardar el escenario.' };
  }
}
