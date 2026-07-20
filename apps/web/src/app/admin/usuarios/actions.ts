'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/guard';
import { createAdminClient } from '@/lib/supabase/admin';
import { registrarAuditoria } from '@/lib/admin/audit';

const NIVELES_VALIDOS = ['registered', 'member', 'verified'] as const;

/** Asigna un rol funcional de app (admin|editor) a un usuario. Solo admin. */
export async function asignarRolApp(formData: FormData) {
  const targetUserId = String(formData.get('userId') ?? '');
  const roleKey = String(formData.get('roleKey') ?? '');
  const { user, supabase } = await requireAdmin(`/admin/usuarios/${targetUserId}`);

  const { data: rol, error: rolError } = await supabase
    .from('app_roles')
    .select('id')
    .eq('key', roleKey)
    .single();
  if (rolError || !rol) throw new Error(`Rol de app desconocido: ${roleKey}`);

  const { error } = await supabase.from('user_app_roles').insert({ user_id: targetUserId, role_id: rol.id });
  if (error) throw new Error(`No se pudo asignar el rol: ${error.message}`);

  await registrarAuditoria(supabase, {
    actorId: user.id,
    action: 'app_role_assigned',
    entity: 'user_app_roles',
    entityId: targetUserId,
    meta: { role: roleKey },
  });

  revalidatePath(`/admin/usuarios/${targetUserId}`);
}

/** Revoca un rol funcional de app ya asignado. Solo admin. */
export async function revocarRolApp(formData: FormData) {
  const targetUserId = String(formData.get('userId') ?? '');
  const roleKey = String(formData.get('roleKey') ?? '');
  const { user, supabase } = await requireAdmin(`/admin/usuarios/${targetUserId}`);

  const { data: rol } = await supabase.from('app_roles').select('id').eq('key', roleKey).single();
  if (!rol) throw new Error(`Rol de app desconocido: ${roleKey}`);

  const { error } = await supabase
    .from('user_app_roles')
    .delete()
    .eq('user_id', targetUserId)
    .eq('role_id', rol.id);
  if (error) throw new Error(`No se pudo revocar el rol: ${error.message}`);

  await registrarAuditoria(supabase, {
    actorId: user.id,
    action: 'app_role_revoked',
    entity: 'user_app_roles',
    entityId: targetUserId,
    meta: { role: roleKey },
  });

  revalidatePath(`/admin/usuarios/${targetUserId}`);
}

/**
 * Cambio de nivel MANUAL desde el panel (excepcional: lo normal es que el
 * nivel cambie por webhook de Stripe/rc-07). `profiles.level` está protegido
 * por un trigger que solo permite tocarlo a `service_role`
 * (profiles_protect_level, 0003_identity.sql) — por eso aquí se usa el
 * cliente admin, JAMÁS desde el navegador. El motivo es obligatorio y queda
 * en `audit_log` junto con el nivel anterior y el nuevo (I6).
 */
export async function cambiarNivelManual(formData: FormData) {
  const targetUserId = String(formData.get('userId') ?? '');
  const nuevoNivel = String(formData.get('nivel') ?? '');
  const motivo = String(formData.get('motivo') ?? '').trim();
  const { user, supabase } = await requireAdmin(`/admin/usuarios/${targetUserId}`);

  if (!motivo) {
    throw new Error('El motivo es obligatorio para cambiar el nivel manualmente.');
  }
  if (!NIVELES_VALIDOS.includes(nuevoNivel as (typeof NIVELES_VALIDOS)[number])) {
    throw new Error(`Nivel inválido: ${nuevoNivel}`);
  }

  const { data: perfilActual, error: perfilError } = await supabase
    .from('profiles')
    .select('level')
    .eq('id', targetUserId)
    .single();
  if (perfilError || !perfilActual) throw new Error('Usuario no encontrado.');

  const nivelAnterior = perfilActual.level;
  if (nivelAnterior === nuevoNivel) {
    throw new Error('El usuario ya tiene ese nivel.');
  }

  const admin = createAdminClient();
  const { error } = await admin.from('profiles').update({ level: nuevoNivel }).eq('id', targetUserId);
  if (error) throw new Error(`No se pudo cambiar el nivel: ${error.message}`);

  // El insert de auditoría va con el cliente autenticado del ADMIN (no el de
  // servicio): la RLS de audit_log exige actor_id = auth.uid(), así se
  // garantiza que el actor registrado es real, nunca un valor inventado.
  await registrarAuditoria(supabase, {
    actorId: user.id,
    action: 'level_changed_manually',
    entity: 'profiles',
    entityId: targetUserId,
    meta: { from: nivelAnterior, to: nuevoNivel, motivo },
  });

  revalidatePath(`/admin/usuarios/${targetUserId}`);
}
