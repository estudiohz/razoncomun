'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/guard';
import { registrarAuditoria } from '@/lib/admin/audit';
import { createAdminClient } from '@/lib/supabase/admin';
import { masterKeyCredencialesIA } from '@/lib/supabase/env';
import { obtenerAal } from '@/lib/auth/mfa';
import { PROVEEDORES_IA } from '@/lib/admin/ia';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * `requireAdmin` (lib/admin/guard.ts) ya exige rol admin, y el middleware
 * global (rc-03, src/middleware.ts) ya exige aal2 antes de dejar renderizar
 * nada bajo `/admin` a quien tiene ese rol — pero una Server Action puede en
 * teoría invocarse con una sesión que perdió el aal2 a mitad de visita
 * (p. ej. sesión larga, token refrescado). Para una acción tan sensible como
 * tocar claves de proveedores de IA, se repite la comprobación aquí como
 * segunda puerta explícita (I5, revision-seguridad.md): "solo con 2FA
 * activo" no es solo un gate de navegación, es un gate de cada escritura.
 */
async function exigirAal2(supabase: SupabaseClient) {
  const { actual } = await obtenerAal(supabase);
  if (actual !== 'aal2') {
    throw new Error(
      'Se requiere verificación en dos pasos (2FA) activa en esta sesión para gestionar claves de IA.',
    );
  }
}

/**
 * Activa un proveedor de IA nuevo (cifra la clave con la clave maestra del
 * entorno, vía `ai_credentials_set` — SOLO `service_role` puede ejecutar esa
 * función, por eso se usa `createAdminClient()`). Exige motivo y la casilla
 * de "he leído el aviso" de la suite de neutralidad — ninguna acción
 * destructiva sin confirmación + motivo (límite del encargo).
 *
 * La propia función SQL ya inserta en `audit_log` (acción
 * `ai_provider_activated`) con actor/proveedor/modelo — aquí se añade una
 * SEGUNDA fila con el motivo en `meta` (la función no acepta ese parámetro:
 * el esquema es de rc-02 y no se toca), enlazada al id de la credencial
 * recién creada. Esta segunda fila se inserta con el cliente autenticado del
 * propio admin (no el de servicio), porque la RLS de `audit_log` exige
 * `actor_id = auth.uid()` — así el actor registrado es siempre real.
 */
export async function activarProveedorIA(formData: FormData) {
  const provider = String(formData.get('provider') ?? '');
  const model = String(formData.get('model') ?? '').trim();
  const apiKey = String(formData.get('apiKey') ?? '').trim();
  const motivo = String(formData.get('motivo') ?? '').trim();
  const avisoLeido = formData.get('avisoLeido');

  const { user, supabase } = await requireAdmin('/admin/ajustes');
  await exigirAal2(supabase);

  if (!PROVEEDORES_IA.includes(provider as (typeof PROVEEDORES_IA)[number])) {
    throw new Error(`Proveedor no soportado: "${provider}".`);
  }
  if (!model) {
    throw new Error('El modelo es obligatorio (ej. claude-opus-4-6, gpt-5, gemini-2.5-pro).');
  }
  if (!apiKey || apiKey.length < 8) {
    throw new Error('La clave de API no es válida (vacía o demasiado corta).');
  }
  if (!motivo) {
    throw new Error('El motivo del cambio de proveedor es obligatorio — queda en auditoría.');
  }
  if (avisoLeido !== 'on') {
    throw new Error('Debes confirmar que has leído el aviso sobre la suite de neutralidad antes de continuar.');
  }

  const admin = createAdminClient();
  const { data: nuevaCredencialId, error } = await admin.rpc('ai_credentials_set', {
    p_provider: provider,
    p_model: model,
    p_api_key: apiKey,
    p_master_key: masterKeyCredencialesIA(),
    p_changed_by: user.id,
  });

  if (error) {
    throw new Error(`No se pudo activar el proveedor: ${error.message}`);
  }

  await registrarAuditoria(supabase, {
    actorId: user.id,
    action: 'ai_provider_activation_reason',
    entity: 'ai_provider_credentials',
    entityId: nuevaCredencialId as string,
    meta: { provider, model, motivo },
  });

  revalidatePath('/admin/ajustes');
}

/**
 * Revierte al proveedor anterior (`ai_credentials_revert` — no necesita la
 * clave maestra, D-016: solo cambia qué fila está `active`). Pensada para
 * el mismo botón que usaría un admin si la suite de neutralidad automática
 * (enganche de rc en `feat/provider-ia`) no llegó a revertir sola, o para
 * deshacer manualmente un cambio reciente.
 */
export async function revertirProveedorIA(formData: FormData) {
  const motivo = String(formData.get('motivo') ?? '').trim();
  const { user, supabase } = await requireAdmin('/admin/ajustes');
  await exigirAal2(supabase);

  if (!motivo) {
    throw new Error('El motivo de la reversión es obligatorio — queda en auditoría.');
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc('ai_credentials_revert', {
    p_reason: motivo,
    p_changed_by: user.id,
  });

  if (error) {
    throw new Error(`No se pudo revertir el proveedor: ${error.message}`);
  }

  revalidatePath('/admin/ajustes');
}

/**
 * Cambia SOLO el modelo del proveedor de IA activo, reutilizando la clave ya
 * cifrada (no la toca ni la descifra). Es un simple UPDATE de la columna
 * `model` de la fila activa: por eso NO hace falta ni la clave maestra ni
 * volver a introducir la API key — corregir un id de modelo mal escrito
 * (p. ej. `gemini-2.5` -> `gemini-2.5-flash`) no debe obligar a repegar nada.
 *
 * A diferencia de `activarProveedorIA`, esto NO crea una fila nueva ni dispara
 * la suite de neutralidad (el `providerWatcher` del servicio detecta cambios por
 * id de credencial, y aquí el id no cambia): es una corrección en caliente, no
 * un cambio de proveedor. Mismas puertas de seguridad que el resto (admin + 2FA
 * + motivo + auditoría).
 */
export async function actualizarModeloProveedorIA(formData: FormData) {
  const model = String(formData.get('model') ?? '').trim();
  const motivo = String(formData.get('motivo') ?? '').trim();
  const { user, supabase } = await requireAdmin('/admin/ajustes');
  await exigirAal2(supabase);

  if (!model) {
    throw new Error('El modelo es obligatorio (ej. gemini-2.5-flash).');
  }
  if (!motivo) {
    throw new Error('El motivo del cambio es obligatorio — queda en auditoría.');
  }

  const admin = createAdminClient();
  const { data: activa, error: errLeer } = await admin
    .from('ai_provider_credentials')
    .select('id, provider, model')
    .eq('active', true)
    .maybeSingle();

  if (errLeer) {
    throw new Error(`No se pudo leer el proveedor activo: ${errLeer.message}`);
  }
  if (!activa) {
    throw new Error('No hay ningún proveedor activo que editar.');
  }
  if (activa.model === model) {
    // Sin cambios: no reescribimos ni registramos auditoría por nada.
    revalidatePath('/admin/ajustes');
    return;
  }

  const { error } = await admin
    .from('ai_provider_credentials')
    .update({ model, changed_by: user.id, changed_at: new Date().toISOString() })
    .eq('id', activa.id);
  if (error) {
    throw new Error(`No se pudo actualizar el modelo: ${error.message}`);
  }

  await registrarAuditoria(supabase, {
    actorId: user.id,
    action: 'ai_provider_model_updated',
    entity: 'ai_provider_credentials',
    entityId: activa.id,
    meta: { provider: activa.provider, from: activa.model, to: model, motivo },
  });

  revalidatePath('/admin/ajustes');
}

/**
 * Elimina por completo el proveedor de IA activo (borra la fila de
 * `ai_provider_credentials`). Pensado para retirar un proveedor mal introducido
 * cuando NO hay uno anterior al que revertir — el caso que `revertirProveedorIA`
 * no cubre. Tras esto no queda ningún proveedor activo: el RC-Brain cae a su
 * fallback de entorno (`ANTHROPIC_API_KEY`) o queda "sin configurar" hasta que
 * se active otro desde el panel.
 *
 * La fila activa es SIEMPRE la más reciente, así que ninguna otra la referencia
 * por `previous_credential_id` (FK auto-referente): borrar la activa es seguro,
 * no rompe la cadena de histórico. Mismas puertas que las demás acciones
 * sensibles: admin + 2FA + motivo + auditoría (I5/I6, revision-seguridad.md).
 */
export async function eliminarProveedorIA(formData: FormData) {
  const motivo = String(formData.get('motivo') ?? '').trim();
  const { user, supabase } = await requireAdmin('/admin/ajustes');
  await exigirAal2(supabase);

  if (!motivo) {
    throw new Error('El motivo de la eliminación es obligatorio — queda en auditoría.');
  }

  const admin = createAdminClient();
  const { data: activa, error: errLeer } = await admin
    .from('ai_provider_credentials')
    .select('id, provider, model')
    .eq('active', true)
    .maybeSingle();

  if (errLeer) {
    throw new Error(`No se pudo leer el proveedor activo: ${errLeer.message}`);
  }
  if (!activa) {
    throw new Error('No hay ningún proveedor activo que eliminar.');
  }

  const { error } = await admin.from('ai_provider_credentials').delete().eq('id', activa.id);
  if (error) {
    throw new Error(`No se pudo eliminar el proveedor: ${error.message}`);
  }

  await registrarAuditoria(supabase, {
    actorId: user.id,
    action: 'ai_provider_deleted',
    entity: 'ai_provider_credentials',
    entityId: activa.id,
    meta: { provider: activa.provider, model: activa.model, motivo },
  });

  revalidatePath('/admin/ajustes');
}

/**
 * Antigüedad mínima de afiliación exigida para voto vinculante (D-017/D-018,
 * 0019_antiguedad_configurable.sql — migración de rc-02, no se toca aquí).
 * `settings.min_membership_days` es SOLO el valor por defecto para
 * votaciones NUEVAS: la fila de `votes` se sella con el valor vigente en el
 * momento de crearla (`votes_seal_min_membership_trg`) y un intento de
 * tocarlo en una votación ya creada falla con `P0001` desde el propio
 * trigger — esta acción nunca puede afectar a una votación en curso, ni con
 * intención ni por error, y no necesita reforzar esa regla aquí porque la
 * garantiza la base de datos.
 *
 * Escritura vía RLS normal (`settings_write_admin`: `is_admin(auth.uid())`)
 * con el cliente de sesión del propio admin — a diferencia de las
 * credenciales de IA, esta tabla NO exige `service_role`.
 */
export async function actualizarAntiguedadMinima(formData: FormData) {
  const dias = Number(formData.get('dias'));
  const motivo = String(formData.get('motivo') ?? '').trim();
  const { user, supabase } = await requireAdmin('/admin/ajustes');

  if (!Number.isInteger(dias) || dias < 0 || dias > 365) {
    throw new Error('Los días deben ser un número entero entre 0 y 365.');
  }
  if (!motivo) {
    throw new Error('El motivo del cambio es obligatorio — queda en auditoría.');
  }

  const { data: actual } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'min_membership_days')
    .maybeSingle();
  const valorAnterior = actual?.value ?? null;

  const { error } = await supabase.from('settings').upsert({
    key: 'min_membership_days',
    value: dias,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    throw new Error(`No se pudo actualizar el ajuste: ${error.message}`);
  }

  await registrarAuditoria(supabase, {
    actorId: user.id,
    action: 'setting_changed',
    entity: 'settings',
    entityId: null,
    meta: { key: 'min_membership_days', from: valorAnterior, to: dias, motivo },
  });

  revalidatePath('/admin/ajustes');
}
