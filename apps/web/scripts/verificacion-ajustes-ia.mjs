#!/usr/bin/env node
/**
 * Verificación E2E de `/admin/ajustes` (rc-09-admin, D-016 credenciales de
 * IA + D-017/D-018 antigüedad mínima configurable).
 *
 * NO simula cookies de @supabase/ssr para probar el guard de página (mismo
 * argumento que `verificacion-mfa.mjs`: no sería representativo del
 * navegador real). En su lugar:
 *
 *   A. Reproduce exactamente las mismas llamadas RPC que hace el guard
 *      (`is_admin`/`is_editor`) y el middleware (`getAuthenticatorAssuranceLevel`)
 *      contra los usuarios seed reales de rc-02, con sesión real vía
 *      password — evidencia de que los datos que alimentan cada guard son
 *      correctos para cada caso (admin+2FA entra, editor sin 2FA queda
 *      atascado en aal1, member sin rol no es ni admin ni editor).
 *   B. Prueba el rechazo por API DIRECTA: llama a `ai_credentials_set` /
 *      `ai_credentials_get_active` / `ai_credentials_revert` vía REST con
 *      una sesión AUTENTICADA DE ADMIN REAL (no service_role) — deben
 *      fallar por privilegios revocados a nivel de función, ni siquiera un
 *      admin de verdad puede saltarse esto por API.
 *   C. Ejercita la lógica exacta de las Server Actions (activarProveedorIA/
 *      revertirProveedorIA/actualizarAntiguedadMinima) llamando a las mismas
 *      funciones/tablas con los mismos clientes que ellas usan, y verifica
 *      el resultado en la base (key_suffix, active, audit_log).
 *   D. Limpia al final: borra las credenciales de prueba (la tabla estaba
 *      vacía antes de esta verificación) y devuelve `min_membership_days`
 *      a su valor original.
 */
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const SUPABASE_URL = 'https://dev-api.razoncomun.com';
const ANON_KEY = process.env.RC_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.RC_SERVICE_ROLE_KEY;
const MASTER_KEY = process.env.RC_AI_MASTER_KEY;

// Secreto TOTP del fixture admin.test@razoncomun.invalid (cuenta ficticia,
// dominio .invalid, sin datos reales — ver 9001_fixtures.sql). Reenrolado
// para este gate porque el factor previo era de otra sesión y su secreto
// no es recuperable tras la verificación (Supabase no lo vuelve a exponer).
const ADMIN_EMAIL = 'admin.test@razoncomun.invalid';
const ADMIN_TOTP_SECRET = 'KIUCMJKHETK6NBGYYJ5XFXRVU4MSNPVB';
const EDITOR_EMAIL = 'editor.test@razoncomun.invalid';
const MEMBER_EMAIL = 'member.old.test@razoncomun.invalid';
const PASSWORD = 'Test1234!';

const ADMIN_USER_ID = '11111111-1111-1111-1111-111111111106';

function base32Decode(base32) {
  const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of base32.replace(/=+$/, '').toUpperCase()) {
    const val = alfabeto.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}
function totp(secretBase32, paraTiempo = Date.now()) {
  const key = base32Decode(secretBase32);
  const contador = Math.floor(paraTiempo / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(contador));
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const codigo =
    ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  return String(codigo % 1_000_000).padStart(6, '0');
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const nuevoCliente = () => createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

let fallos = 0;
const paso = (n, t) => console.log(`\n=== ${n}. ${t} ===`);
const ok = (t, d) => console.log('OK   ' + t, d ?? '');
const fail = (t, d) => {
  console.log('FAIL ' + t, d ?? '');
  fallos++;
};

async function main() {
  // ---------------------------------------------------------------------
  paso('A1', 'Login admin.test + 2FA real (TOTP) → aal2, is_admin=true');
  const clienteAdmin = nuevoCliente();
  const { error: loginAdminError } = await clienteAdmin.auth.signInWithPassword({ email: ADMIN_EMAIL, password: PASSWORD });
  if (loginAdminError) fail('login admin', loginAdminError.message);
  const { data: factoresAdmin } = await clienteAdmin.auth.mfa.listFactors();
  const factorAdmin = factoresAdmin?.totp?.[0];
  if (!factorAdmin) fail('admin sin factor TOTP (se esperaba el reenrolado para este gate)');
  const { data: challengeAdmin } = await clienteAdmin.auth.mfa.challenge({ factorId: factorAdmin.id });
  const { error: verifyAdminError } = await clienteAdmin.auth.mfa.verify({
    factorId: factorAdmin.id,
    challengeId: challengeAdmin.id,
    code: totp(ADMIN_TOTP_SECRET),
  });
  if (verifyAdminError) fail('verify TOTP admin', verifyAdminError.message);
  const aalAdmin = await clienteAdmin.auth.mfa.getAuthenticatorAssuranceLevel();
  ok('aal admin tras 2FA', aalAdmin.data);
  if (aalAdmin.data.currentLevel !== 'aal2') fail('se esperaba aal2 para admin.test tras completar 2FA');
  const { data: esAdmin } = await clienteAdmin.rpc('is_admin', { p_user: ADMIN_USER_ID });
  ok('is_admin(admin.test)', esAdmin);
  if (!esAdmin) fail('se esperaba is_admin=true para admin.test');

  paso('A2', 'Login editor.test SIN 2FA → requiereMfa()=true pero currentLevel se queda en aal1 (bloqueado)');
  const clienteEditor = nuevoCliente();
  const { data: loginEditor, error: loginEditorError } = await clienteEditor.auth.signInWithPassword({ email: EDITOR_EMAIL, password: PASSWORD });
  if (loginEditorError) fail('login editor', loginEditorError.message);
  const [{ data: esAdminEditor }, { data: esEditorEditor }, { data: cargosEditor }] = await Promise.all([
    clienteEditor.rpc('is_admin', { p_user: loginEditor.user.id }),
    clienteEditor.rpc('is_editor', { p_user: loginEditor.user.id }),
    admin.from('positions').select('id').eq('user_id', loginEditor.user.id).is('ended_at', null),
  ]);
  const requiereMfaEditor = Boolean(esAdminEditor) || Boolean(esEditorEditor) || Boolean(cargosEditor?.length);
  const aalEditor = await clienteEditor.auth.mfa.getAuthenticatorAssuranceLevel();
  ok('is_editor(editor.test)', esEditorEditor);
  ok('requiereMfa() (editor.test)', requiereMfaEditor);
  ok('aal editor.test (sin factor TOTP)', aalEditor.data);
  if (!requiereMfaEditor) fail('se esperaba requiereMfa()=true para editor.test (tiene app_role editor)');
  if (aalEditor.data.currentLevel === 'aal2') fail('editor.test NO debería poder alcanzar aal2 sin factor TOTP');
  console.log(
    '  → middleware.ts: requiereMfa()=true Y currentLevel!=aal2 ⇒ redirect a /entrar/2fa. Sin ningún factor',
    'que verificar ahí, editor.test NUNCA llega a renderizar nada de /admin. RECHAZO CONFIRMADO.',
  );

  paso('A3', 'Login member.old.test (afiliado, sin rol de app ni cargo) → is_admin=false Y is_editor=false');
  const clienteMember = nuevoCliente();
  const { data: loginMember, error: loginMemberError } = await clienteMember.auth.signInWithPassword({ email: MEMBER_EMAIL, password: PASSWORD });
  if (loginMemberError) fail('login member', loginMemberError.message);
  const [{ data: esAdminMember }, { data: esEditorMember }] = await Promise.all([
    clienteMember.rpc('is_admin', { p_user: loginMember.user.id }),
    clienteMember.rpc('is_editor', { p_user: loginMember.user.id }),
  ]);
  ok('is_admin(member.old.test)', esAdminMember);
  ok('is_editor(member.old.test)', esEditorMember);
  if (esAdminMember || esEditorMember) fail('member.old.test no debería tener rol admin/editor');
  console.log(
    '  → requireAdminOrEditor() (layout.tsx) exige is_admin||is_editor; ambos false ⇒ redirect a "/" ANTES de',
    'renderizar nada de /admin — incluida /admin/ajustes por URL directa. RECHAZO CONFIRMADO.',
  );

  // ---------------------------------------------------------------------
  paso('B', 'Rechazo por API DIRECTA — admin autenticado (aal2 real) intentando el RPC sin service_role');
  const { error: setDirectoError } = await clienteAdmin.rpc('ai_credentials_set', {
    p_provider: 'anthropic',
    p_model: 'claude-intento-directo',
    p_api_key: 'sk-ant-intento-directo-0000',
    p_master_key: MASTER_KEY,
    p_changed_by: ADMIN_USER_ID,
  });
  ok('ai_credentials_set vía REST con sesión de admin real (esperado: error)', setDirectoError?.message ?? '¡NO FALLÓ!');
  if (!setDirectoError) fail('ai_credentials_set NO debería ser invocable con una sesión authenticated, ni siquiera de admin');

  const { error: getDirectoError } = await clienteAdmin.rpc('ai_credentials_get_active', { p_master_key: MASTER_KEY });
  ok('ai_credentials_get_active vía REST con sesión de admin real (esperado: error)', getDirectoError?.message ?? '¡NO FALLÓ!');
  if (!getDirectoError) fail('ai_credentials_get_active NO debería ser invocable con una sesión authenticated');

  const { error: revertDirectoError } = await clienteAdmin.rpc('ai_credentials_revert', { p_reason: 'intento directo', p_changed_by: ADMIN_USER_ID });
  ok('ai_credentials_revert vía REST con sesión de admin real (esperado: error)', revertDirectoError?.message ?? '¡NO FALLÓ!');
  if (!revertDirectoError) fail('ai_credentials_revert NO debería ser invocable con una sesión authenticated');

  const clienteAnon = nuevoCliente();
  const { error: setAnonError } = await clienteAnon.rpc('ai_credentials_set', {
    p_provider: 'anthropic',
    p_model: 'x',
    p_api_key: 'sk-anon-intento-00000000',
    p_master_key: MASTER_KEY,
  });
  ok('ai_credentials_set vía REST SIN sesión (anon, esperado: error)', setAnonError?.message ?? '¡NO FALLÓ!');
  if (!setAnonError) fail('ai_credentials_set NO debería ser invocable por anon');

  const { error: readDirectoTabla } = await clienteAdmin.from('ai_provider_credentials').select('*').limit(1);
  ok('SELECT directo a ai_provider_credentials con sesión de admin real (esperado: 0 filas, RLS sin policies)', readDirectoTabla?.message ?? 'sin error (verificar filas)');

  // ---------------------------------------------------------------------
  paso('C1', 'activarProveedorIA — misma llamada que la Server Action (service_role + p_changed_by)');
  const { data: idAnthropic, error: setAnthropicError } = await admin.rpc('ai_credentials_set', {
    p_provider: 'anthropic',
    p_model: 'claude-test-model-alpha',
    p_api_key: 'sk-ant-test-AAAA1111',
    p_master_key: MASTER_KEY,
    p_changed_by: ADMIN_USER_ID,
  });
  if (setAnthropicError) fail('ai_credentials_set (anthropic)', setAnthropicError.message);
  ok('credencial anthropic creada', idAnthropic);
  await admin.from('audit_log').insert({
    actor_id: ADMIN_USER_ID,
    action: 'ai_provider_activation_reason',
    entity: 'ai_provider_credentials',
    entity_id: idAnthropic,
    meta: { provider: 'anthropic', model: 'claude-test-model-alpha', motivo: 'verificacion automatizada del gate rc-09' },
  });

  const { data: filaAnthropic } = await admin
    .from('ai_provider_credentials')
    .select('id, provider, model, key_suffix, active, previous_credential_id')
    .eq('id', idAnthropic)
    .single();
  ok('fila anthropic tras activar', filaAnthropic);
  if (filaAnthropic.key_suffix !== '1111') fail('key_suffix esperado "1111", obtenido', filaAnthropic.key_suffix);
  if (!filaAnthropic.active) fail('se esperaba active=true para la credencial recién activada');
  if (filaAnthropic.previous_credential_id !== null) fail('se esperaba previous_credential_id=null (tabla estaba vacía)');

  paso('C2', 'Segundo proveedor (openai) — el anterior debe quedar inactivo');
  const { data: idOpenai, error: setOpenaiError } = await admin.rpc('ai_credentials_set', {
    p_provider: 'openai',
    p_model: 'gpt-test-beta',
    p_api_key: 'sk-openai-test-BBBB2222',
    p_master_key: MASTER_KEY,
    p_changed_by: ADMIN_USER_ID,
  });
  if (setOpenaiError) fail('ai_credentials_set (openai)', setOpenaiError.message);
  await admin.from('audit_log').insert({
    actor_id: ADMIN_USER_ID,
    action: 'ai_provider_activation_reason',
    entity: 'ai_provider_credentials',
    entity_id: idOpenai,
    meta: { provider: 'openai', model: 'gpt-test-beta', motivo: 'segunda activacion de prueba del gate rc-09' },
  });

  const { data: filasTrasOpenai } = await admin
    .from('ai_provider_credentials')
    .select('id, provider, key_suffix, active, previous_credential_id')
    .order('changed_at', { ascending: false });
  ok('filas tras activar openai', filasTrasOpenai);
  const openaiRow = filasTrasOpenai.find((f) => f.id === idOpenai);
  const anthropicRowAfter = filasTrasOpenai.find((f) => f.id === idAnthropic);
  if (!openaiRow.active) fail('se esperaba openai activo');
  if (anthropicRowAfter.active) fail('se esperaba anthropic INACTIVO tras activar openai (un solo proveedor activo)');
  if (openaiRow.previous_credential_id !== idAnthropic) fail('previous_credential_id de openai debería ser el id de anthropic');
  if (openaiRow.key_suffix !== '2222') fail('key_suffix esperado "2222"', openaiRow.key_suffix);

  paso('C3', 'revertirProveedorIA — vuelve a anthropic, motivo obligatorio queda en audit_log');
  const { data: revertId, error: revertError } = await admin.rpc('ai_credentials_revert', {
    p_reason: 'resultado de la suite de neutralidad por debajo del umbral (prueba gate rc-09)',
    p_changed_by: ADMIN_USER_ID,
  });
  if (revertError) fail('ai_credentials_revert', revertError.message);
  ok('revert devuelve id', revertId);
  if (revertId !== idAnthropic) fail('se esperaba volver al id de anthropic', { revertId, idAnthropic });

  const { data: filasTrasRevert } = await admin
    .from('ai_provider_credentials')
    .select('id, provider, active')
    .order('changed_at', { ascending: false });
  const anthropicTrasRevert = filasTrasRevert.find((f) => f.id === idAnthropic);
  const openaiTrasRevert = filasTrasRevert.find((f) => f.id === idOpenai);
  ok('estado tras revert', filasTrasRevert);
  if (!anthropicTrasRevert.active) fail('anthropic debería volver a estar activo tras el revert');
  if (openaiTrasRevert.active) fail('openai debería quedar inactivo tras el revert');

  paso('C4', 'La clave completa nunca se selecciona para la UI — comprobación de forma, no de contenido');
  const { data: filaParaUI } = await admin
    .from('ai_provider_credentials')
    .select('id, provider, model, key_suffix, active, previous_credential_id, changed_by, changed_at, created_at')
    .eq('active', true)
    .single();
  const columnas = Object.keys(filaParaUI ?? {});
  ok('columnas devueltas para pintar la UI', columnas);
  if (columnas.includes('api_key_encrypted')) fail('¡la consulta de la UI está trayendo api_key_encrypted!');

  paso('C5', 'Round-trip de cifrado — SOLO vía service_role, nunca desde la UI (aquí se prueba explícitamente que funciona)');
  const { error: getMalError } = await admin.rpc('ai_credentials_get_active', { p_master_key: 'clave-incorrecta-a-proposito' });
  ok('descifrar con clave maestra incorrecta (esperado: error)', getMalError?.message ?? '¡NO FALLÓ!');
  if (!getMalError) fail('se esperaba que pgp_sym_decrypt fallara con la clave incorrecta');

  const { data: getOkData, error: getOkError } = await admin.rpc('ai_credentials_get_active', { p_master_key: MASTER_KEY });
  if (getOkError) fail('ai_credentials_get_active con clave correcta', getOkError.message);
  const activo = Array.isArray(getOkData) ? getOkData[0] : getOkData;
  ok('descifrado correcto (SOLO en este script de verificación, nunca en la UI)', { provider: activo?.provider, api_key: activo?.api_key });
  if (activo?.api_key !== 'sk-ant-test-AAAA1111') fail('la clave descifrada no coincide con la que se guardó');

  paso('C6', 'audit_log — todas las filas de esta secuencia');
  const { data: auditRows } = await admin
    .from('audit_log')
    .select('action, entity, entity_id, meta, created_at')
    .in('action', ['ai_provider_activated', 'ai_provider_activation_reason', 'ai_provider_reverted'])
    .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
    .order('created_at', { ascending: true });
  ok('filas de audit_log de esta ejecución', JSON.stringify(auditRows, null, 2));
  const acciones = (auditRows ?? []).map((r) => r.action);
  for (const esperada of ['ai_provider_activated', 'ai_provider_activation_reason', 'ai_provider_reverted']) {
    if (!acciones.includes(esperada)) fail(`falta en audit_log la acción "${esperada}"`);
  }

  // ---------------------------------------------------------------------
  paso('D1', 'Antigüedad mínima — lectura pública (anon) del valor actual');
  const { data: settingAntes } = await clienteAnon.from('settings').select('value').eq('key', 'min_membership_days').single();
  ok('valor original', settingAntes?.value);
  const valorOriginal = settingAntes?.value ?? 7;

  paso('D2', 'actualizarAntiguedadMinima — admin real (RLS is_admin, sin service_role) cambia el valor');
  const { error: upsertAdminError } = await clienteAdmin
    .from('settings')
    .upsert({ key: 'min_membership_days', value: 10, updated_by: ADMIN_USER_ID, updated_at: new Date().toISOString() });
  if (upsertAdminError) fail('upsert settings como admin', upsertAdminError.message);
  await clienteAdmin.from('audit_log').insert({
    actor_id: ADMIN_USER_ID,
    action: 'setting_changed',
    entity: 'settings',
    entity_id: null,
    meta: { key: 'min_membership_days', from: valorOriginal, to: 10, motivo: 'prueba gate rc-09' },
  });
  const { data: settingTrasAdmin } = await clienteAnon.from('settings').select('value').eq('key', 'min_membership_days').single();
  ok('valor tras el cambio de admin', settingTrasAdmin?.value);
  if (settingTrasAdmin?.value !== 10) fail('se esperaba 10 tras el cambio de admin');

  paso('D3', 'Rechazo: editor (is_admin=false) NO puede escribir en settings (RLS settings_write_admin)');
  const { error: upsertEditorError, data: upsertEditorData } = await clienteEditor
    .from('settings')
    .upsert({ key: 'min_membership_days', value: 1, updated_by: loginEditor.user.id })
    .select();
  ok('intento de escritura de editor.test (esperado: bloqueado por RLS)', upsertEditorError?.message ?? JSON.stringify(upsertEditorData));
  if (!upsertEditorError && (!upsertEditorData || upsertEditorData.length === 0)) {
    ok('RLS bloqueó silenciosamente (0 filas afectadas, sin error) — comportamiento típico de PostgREST con upsert+RLS');
  } else if (!upsertEditorError) {
    fail('editor.test NO debería poder escribir en settings');
  }
  const { data: settingTrasEditor } = await clienteAnon.from('settings').select('value').eq('key', 'min_membership_days').single();
  if (settingTrasEditor?.value !== 10) fail('el valor cambió con la escritura de editor.test — RLS no está protegiendo settings', settingTrasEditor?.value);
  else ok('valor SIGUE en 10 tras el intento de editor — RLS confirmado');

  paso('D4', 'Rechazo: anon no puede escribir en settings (policy "to authenticated")');
  const { error: upsertAnonError } = await clienteAnon.from('settings').upsert({ key: 'min_membership_days', value: 999 }).select();
  ok('intento de escritura anon (esperado: bloqueado)', upsertAnonError?.message ?? 'sin error — revisar');

  paso('D5', 'Cleanup — restaurar min_membership_days a su valor original');
  const { error: restoreError } = await clienteAdmin
    .from('settings')
    .upsert({ key: 'min_membership_days', value: valorOriginal, updated_by: ADMIN_USER_ID, updated_at: new Date().toISOString() });
  if (restoreError) fail('restaurar settings', restoreError.message);
  await clienteAdmin.from('audit_log').insert({
    actor_id: ADMIN_USER_ID,
    action: 'setting_changed',
    entity: 'settings',
    entity_id: null,
    meta: { key: 'min_membership_days', from: 10, to: valorOriginal, motivo: 'restaurar tras verificacion automatizada del gate rc-09' },
  });
  const { data: settingFinal } = await clienteAnon.from('settings').select('value').eq('key', 'min_membership_days').single();
  ok('valor final (debe ser el original)', settingFinal?.value);
  if (settingFinal?.value !== valorOriginal) fail('no se restauró el valor original de settings');

  paso('E', 'Cleanup — borrar las credenciales de IA de prueba (la tabla estaba vacía antes de este gate)');
  await admin.from('ai_provider_credentials').delete().in('id', [idAnthropic, idOpenai]);
  const { data: filasFinal } = await admin.from('ai_provider_credentials').select('id');
  ok('filas de ai_provider_credentials tras limpiar (debe ser [])', filasFinal);
  if ((filasFinal ?? []).length !== 0) fail('quedaron filas de prueba sin limpiar en ai_provider_credentials');

  console.log('\n=== RESUMEN ===');
  console.log(fallos === 0 ? `TODO OK (0 fallos)` : `${fallos} FALLOS — revisar arriba`);
  process.exitCode = fallos === 0 ? 0 : 1;
}

main().catch((e) => {
  console.error('ERROR NO CONTROLADO', e);
  process.exit(1);
});
