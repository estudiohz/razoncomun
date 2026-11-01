'use server';

import { revalidatePath } from 'next/cache';
import { requireAuditor } from '@/lib/admin/guard';

const ESTADOS = ['nuevo', 'en_revision', 'descartado', 'procesado'] as const;
export type EstadoAuditoria = (typeof ESTADOS)[number];

/** Cambia el estado (y opcionalmente la nota) de un envío del bot. RLS: solo auditores (D-A06). */
export async function actualizarAuditoria(id: string, estado: EstadoAuditoria, notas: string | null) {
  const { supabase, user } = await requireAuditor('/admin/presupuesto/auditorias');
  if (!ESTADOS.includes(estado)) return { error: 'Estado no válido' };

  const { error } = await supabase
    .from('watchdog_sources')
    .update({
      status: estado,
      notes: notas?.trim() ? notas.trim().slice(0, 2000) : null,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq('id', id);

  if (error) return { error: error.message };
  revalidatePath('/admin/presupuesto/auditorias');
  return { ok: true };
}
