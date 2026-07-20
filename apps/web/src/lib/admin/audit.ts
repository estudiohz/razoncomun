import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Inserta una fila en `audit_log` (I6, revision-seguridad.md). La tabla es
 * append-only de verdad: UPDATE/DELETE están revocados incluso a
 * `service_role` a nivel de privilegios (0013_audit.sql) — aquí solo se
 * inserta, nunca se toca una fila existente.
 *
 * Toda acción de escritura del panel (asignar/cesar cargo, asignar/revocar
 * rol de app, cambio de nivel manual, alta/edición de punto del manifiesto)
 * pasa por aquí. `actorId` es SIEMPRE quien pulsó el botón en el panel
 * (nunca null, salvo automatismos de sistema que no tocan este agente).
 */
export async function registrarAuditoria(
  supabase: SupabaseClient,
  entrada: {
    actorId: string;
    action: string;
    entity: string;
    entityId?: string | null;
    meta?: Record<string, unknown>;
  },
) {
  const { error } = await supabase.from('audit_log').insert({
    actor_id: entrada.actorId,
    action: entrada.action,
    entity: entrada.entity,
    entity_id: entrada.entityId ?? null,
    meta: entrada.meta ?? {},
  });

  if (error) {
    // No abortamos la operación de negocio por un fallo de auditoría, pero
    // sí lo dejamos gritando en logs de servidor: I6 lo exige "todo queda
    // auditado", un fallo silencioso aquí sería justo el hueco que no
    // podemos permitirnos.
    console.error('[audit_log] fallo al registrar', entrada, error);
    throw new Error(`No se pudo registrar la auditoría de "${entrada.action}": ${error.message}`);
  }
}
