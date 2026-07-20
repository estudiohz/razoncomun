'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/guard';
import { registrarAuditoria } from '@/lib/admin/audit';

const CARGOS_NACIONALES = ['president', 'treasurer', 'vocal', 'council_member'];
const CARGOS_COMUNIDAD = ['coordinator', 'moderator'];
const CARGOS_VALIDOS = [...CARGOS_NACIONALES, ...CARGOS_COMUNIDAD];

/**
 * Asigna un cargo orgánico (nacional o de comunidad). Solo admin (RLS
 * positions_insert_admin). El CHECK de BD (`positions_scope_territory_chk`,
 * 0003_identity.sql) solo obliga a que `territory_id` sea NULL en nacional y
 * no-NULL en comunidad — NO impide un despiste tipo "presidente de
 * comunidad" o "coordinador nacional" (el CHECK de `role` acepta los 6
 * valores sin mirar `scope`). Esa coherencia rol↔ámbito se valida aquí, en
 * la capa de aplicación, antes de tocar la tabla.
 */
export async function asignarCargo(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const role = String(formData.get('role') ?? '');
  const ambito = String(formData.get('ambito') ?? '');
  const { user, supabase } = await requireAdmin('/admin/organizacion');

  if (!CARGOS_VALIDOS.includes(role)) throw new Error(`Cargo inválido: ${role}`);

  const esNacional = ambito === 'national';

  if (esNacional && !CARGOS_NACIONALES.includes(role)) {
    throw new Error(`"${role}" no es un cargo nacional — elige un ámbito de comunidad.`);
  }
  if (!esNacional && !CARGOS_COMUNIDAD.includes(role)) {
    throw new Error(`"${role}" no es un cargo de comunidad — elige ámbito nacional.`);
  }

  const { data: perfilObjetivo, error: perfilError } = await supabase
    .from('profiles')
    .select('id, display_name')
    .eq('email', email)
    .single();
  if (perfilError || !perfilObjetivo) {
    throw new Error(`No existe ningún usuario con el email "${email}".`);
  }

  const territoryId = esNacional ? null : Number(ambito.replace('community:', ''));
  if (!esNacional && !Number.isFinite(territoryId)) {
    throw new Error('Ámbito de comunidad inválido.');
  }

  const { data: cargoInsertado, error } = await supabase
    .from('positions')
    .insert({
      user_id: perfilObjetivo.id,
      role,
      scope: esNacional ? 'national' : 'community',
      territory_id: esNacional ? null : territoryId,
    })
    .select('id')
    .single();
  if (error) throw new Error(`No se pudo asignar el cargo: ${error.message}`);

  await registrarAuditoria(supabase, {
    actorId: user.id,
    action: 'position_assigned',
    entity: 'positions',
    entityId: cargoInsertado.id,
    meta: {
      target_user: perfilObjetivo.id,
      target_email: email,
      role,
      scope: esNacional ? 'national' : 'community',
      territory_id: esNacional ? null : territoryId,
    },
  });

  revalidatePath('/admin/organizacion');
  revalidatePath('/transparencia/organigrama');
}

/** Cesa un cargo vigente (ended_at = now). Exige motivo — queda en audit_log (I6). */
export async function cesarCargo(formData: FormData) {
  const positionId = String(formData.get('positionId') ?? '');
  const motivo = String(formData.get('motivo') ?? '').trim();
  const { user, supabase } = await requireAdmin('/admin/organizacion');

  if (!motivo) throw new Error('El motivo del cese es obligatorio.');

  const { data: cargo, error: cargoError } = await supabase
    .from('positions')
    .select('*')
    .eq('id', positionId)
    .single();
  if (cargoError || !cargo) throw new Error('Cargo no encontrado.');
  if (cargo.ended_at) throw new Error('Ese cargo ya estaba cesado.');

  const { error } = await supabase
    .from('positions')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', positionId);
  if (error) throw new Error(`No se pudo cesar el cargo: ${error.message}`);

  await registrarAuditoria(supabase, {
    actorId: user.id,
    action: 'position_ended',
    entity: 'positions',
    entityId: positionId,
    meta: {
      target_user: cargo.user_id,
      role: cargo.role,
      scope: cargo.scope,
      territory_id: cargo.territory_id,
      motivo,
    },
  });

  revalidatePath('/admin/organizacion');
  revalidatePath('/transparencia/organigrama');
}
