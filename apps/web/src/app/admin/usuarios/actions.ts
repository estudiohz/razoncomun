'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/guard';
import { createAdminClient } from '@/lib/supabase/admin';
import { registrarAuditoria } from '@/lib/admin/audit';
import { enviarCorreo } from '@/lib/email/enviar';
import { METADATA_ALTA } from '@/lib/auth/alta';

const NIVELES_VALIDOS = ['registered', 'member', 'verified'] as const;

export interface ResultadoInvitacion {
  ok: boolean;
  error?: string;
  emailEnviado?: boolean;
  /** Enlace de invitación, para copiarlo a mano si el email no llegó a salir. */
  enlace?: string;
  email?: string;
}

/**
 * Crea una cuenta NUEVA e invita por email (opción elegida por Sergio). Usa
 * `generateLink({type:'invite'})` del admin API (service_role): crea el usuario
 * en Auth —el trigger handle_new_user (0003) le crea el `profiles`— y devuelve
 * el token del enlace. El correo lo enviamos NOSOTROS con el SMTP propio de la
 * app (lib/email/enviar), enlazando a /auth/confirm?type=invite: así no
 * dependemos de personalizar las plantillas de GoTrue (pendiente de infra,
 * AUTH-SETUP.md §4). Tras verificar, destinoTrasVerificar manda al usuario a
 * establecer su contraseña (/recuperar/actualizar), igual que en recovery.
 *
 * Si el email no puede salir (RC_SMTP_* sin configurar), NO falla: devuelve el
 * enlace para que el admin lo comparta a mano. Todo queda en `audit_log`.
 *
 * Para hacer admin a alguien que YA tiene cuenta, NO se usa esto: se asigna el
 * rol desde su ficha (asignarRolApp).
 */
export async function invitarUsuario(
  _previo: ResultadoInvitacion | null,
  formData: FormData,
): Promise<ResultadoInvitacion> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const displayName = String(formData.get('display_name') ?? '').trim();
  const roleKey = String(formData.get('roleKey') ?? '').trim();
  const { user, supabase } = await requireAdmin('/admin/usuarios');

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: 'Email inválido.' };
  }
  if (roleKey && roleKey !== 'admin' && roleKey !== 'editor') {
    return { ok: false, error: `Rol inválido: ${roleKey}.` };
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/+$/, '');
  if (!siteUrl) {
    return { ok: false, error: 'Falta NEXT_PUBLIC_SITE_URL en el entorno del servidor.' };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: {
      data: displayName ? { [METADATA_ALTA.nombre]: displayName } : undefined,
      redirectTo: `${siteUrl}/auth/confirm`,
    },
  });

  if (error || !data?.user || !data.properties?.hashed_token) {
    const msg = error?.message ?? 'respuesta inesperada del servidor de auth';
    // Caso típico: el email ya existe -> se gestiona desde su ficha, no aquí.
    const yaExiste = /registered|already|exists/i.test(msg);
    return {
      ok: false,
      error: yaExiste
        ? 'Ya existe una cuenta con ese email. Para darle permisos, búscala en el listado y asígnale el rol desde su ficha.'
        : `No se pudo crear la invitación: ${msg}`,
    };
  }

  const nuevoUsuarioId = data.user.id;
  const tokenHash = data.properties.hashed_token;

  if (displayName) {
    await admin.from('profiles').update({ display_name: displayName }).eq('id', nuevoUsuarioId);
  }

  if (roleKey === 'admin' || roleKey === 'editor') {
    const { data: rol } = await admin.from('app_roles').select('id').eq('key', roleKey).single();
    if (rol) {
      await admin
        .from('user_app_roles')
        .upsert({ user_id: nuevoUsuarioId, role_id: rol.id }, { onConflict: 'user_id,role_id' });
    }
  }

  const enlace = `${siteUrl}/auth/confirm?token_hash=${encodeURIComponent(
    tokenHash,
  )}&type=invite&next=${encodeURIComponent('/perfil')}`;

  const nombreCorto = displayName || email;
  const envio = await enviarCorreo({
    para: email,
    asunto: 'Te han invitado a Razón Común',
    texto:
      `Hola ${nombreCorto}:\n\n` +
      `Te han dado acceso a la plataforma de Razón Común. Para activar tu cuenta y elegir tu ` +
      `contraseña, entra aquí:\n\n${enlace}\n\n` +
      `Si no esperabas este correo, puedes ignorarlo.`,
    html:
      `<div style="font-family:Arial,sans-serif;font-size:15px;color:#222;line-height:1.5">` +
      `<p>Hola ${nombreCorto}:</p>` +
      `<p>Te han dado acceso a la plataforma de <strong>Razón Común</strong>. ` +
      `Para activar tu cuenta y elegir tu contraseña, pulsa el botón:</p>` +
      `<p><a href="${enlace}" style="display:inline-block;background:#16B8A0;color:#fff;` +
      `text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:10px">Activar mi cuenta</a></p>` +
      `<p style="font-size:12px;color:#777">Si el botón no funciona, copia y pega esta dirección:<br>${enlace}</p>` +
      `<p style="font-size:12px;color:#777">Si no esperabas este correo, puedes ignorarlo.</p>` +
      `</div>`,
  });

  await registrarAuditoria(supabase, {
    actorId: user.id,
    action: 'user_invited',
    entity: 'auth.users',
    entityId: nuevoUsuarioId,
    meta: { email, role: roleKey || null, email_enviado: envio.enviado },
  });

  revalidatePath('/admin/usuarios');
  return { ok: true, emailEnviado: envio.enviado, enlace, email };
}

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
