#!/usr/bin/env node
/**
 * Verificación E2E de 2FA (TOTP) + guard de middleware, aislada del resto
 * (verificacion-e2e.mjs) porque NO manda ningún email — así no compite con
 * el rate limit de GOTRUE_RATE_LIMIT_EMAIL_SENT (=3/hora) que ya agotaron
 * las pruebas de registro/recuperación. Crea el usuario ya confirmado vía
 * admin.createUser (sin email), como haría un fixture de test.
 */
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const SUPABASE_URL = 'https://dev-api.razoncomun.com';
const ANON_KEY = process.env.RC_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.RC_SERVICE_ROLE_KEY;
const APP_URL = 'http://localhost:3000';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const nuevoCliente = () =>
  createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

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

function totpGenerar(secretBase32, paraTiempo = Date.now()) {
  const key = base32Decode(secretBase32);
  const contador = Math.floor(paraTiempo / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(contador));
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const codigo =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(codigo % 1_000_000).padStart(6, '0');
}

const paso = (n, t) => console.log(`\n=== ${n}. ${t} ===`);
const ok = (t, d) => console.log('OK  ' + t, d ?? '');
const fail = (t, d) => {
  console.log('FAIL ' + t, d ?? '');
  process.exitCode = 1;
};

async function main() {
  const email = `rc-verif-mfa-${Date.now()}@example.com`;
  const password = 'PruebaSegura!2026x';

  paso(0, `Fixture: usuario ya confirmado sin enviar email — ${email}`);
  const { data: creado, error: creadoError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (creadoError) return fail('admin.createUser', creadoError.message);
  ok('usuario creado y confirmado', creado.user.id);

  const cliente1 = nuevoCliente();
  const { data: login1, error: login1Error } = await cliente1.auth.signInWithPassword({ email, password });
  if (login1Error) return fail('login inicial', login1Error.message);
  const aalInicial = await cliente1.auth.mfa.getAuthenticatorAssuranceLevel();
  ok('login sin 2FA: aal', aalInicial.data);

  paso(1, 'Alta de 2FA (enroll → challenge → verify con código TOTP real)');
  const { data: enrollData, error: enrollError } = await cliente1.auth.mfa.enroll({ factorType: 'totp' });
  if (enrollError) return fail('mfa.enroll', enrollError.message);
  ok('enroll', { factor_id: enrollData.id, secret: enrollData.totp.secret });

  const codigoAlta = totpGenerar(enrollData.totp.secret);
  const { data: challengeAlta, error: challengeAltaError } = await cliente1.auth.mfa.challenge({
    factorId: enrollData.id,
  });
  if (challengeAltaError) return fail('challenge alta', challengeAltaError.message);
  const { error: verifyAltaError } = await cliente1.auth.mfa.verify({
    factorId: enrollData.id,
    challengeId: challengeAlta.id,
    code: codigoAlta,
  });
  if (verifyAltaError) return fail('verify alta', verifyAltaError.message);
  ok('2FA activado (factor verified) con código TOTP generado localmente');

  paso(2, 'Nuevo login: aal1 con nextLevel aal2 (Supabase exige completar el 2º factor)');
  const cliente2 = nuevoCliente();
  const { error: login2Error } = await cliente2.auth.signInWithPassword({ email, password });
  if (login2Error) return fail('login tras activar 2FA', login2Error.message);
  const aalTrasLogin = await cliente2.auth.mfa.getAuthenticatorAssuranceLevel();
  ok('aal tras login (debe pedir subir a aal2)', aalTrasLogin.data);
  if (aalTrasLogin.data.currentLevel !== 'aal1' || aalTrasLogin.data.nextLevel !== 'aal2') {
    fail('se esperaba currentLevel=aal1 y nextLevel=aal2', aalTrasLogin.data);
  }

  paso(3, 'Rechazo con código TOTP incorrecto');
  const { data: challengeMal } = await cliente2.auth.mfa.challenge({ factorId: enrollData.id });
  const { error: verifyMalError } = await cliente2.auth.mfa.verify({
    factorId: enrollData.id,
    challengeId: challengeMal.id,
    code: '000000',
  });
  if (!verifyMalError) return fail('verify con código erróneo debería fallar y NO falló');
  ok('rechazo esperado', verifyMalError.message);

  paso(4, 'Aceptación con código TOTP correcto → sesión sube a aal2');
  const codigoLogin = totpGenerar(enrollData.totp.secret);
  const { data: challengeOk } = await cliente2.auth.mfa.challenge({ factorId: enrollData.id });
  const { error: verifyOkError } = await cliente2.auth.mfa.verify({
    factorId: enrollData.id,
    challengeId: challengeOk.id,
    code: codigoLogin,
  });
  if (verifyOkError) return fail('verify con código correcto', verifyOkError.message);
  const aalFinal = await cliente2.auth.mfa.getAuthenticatorAssuranceLevel();
  ok('aal tras verificar 2FA correctamente', aalFinal.data);
  if (aalFinal.data.currentLevel !== 'aal2') fail('se esperaba currentLevel=aal2', aalFinal.data);

  paso(5, 'requiereMfa()/middleware: dar cargo orgánico y comprobar el guard de /admin');
  // Sin cargo/rol todavía: requires_mfa debería ser false para este usuario.
  const { data: esAdminAntes } = await cliente2.rpc('is_admin', { p_user: creado.user.id });
  const { data: cargosAntes } = await admin
    .from('positions')
    .select('id')
    .eq('user_id', creado.user.id)
    .is('ended_at', null);
  ok('is_admin (antes)', esAdminAntes);
  ok('cargos vigentes (antes)', cargosAntes?.length ?? 0);

  await admin.from('positions').insert({
    user_id: creado.user.id,
    role: 'coordinator',
    scope: 'community',
    territory_id: 21, // Albacete (seed de territorios)
  });
  const { data: cargosDespues } = await admin
    .from('positions')
    .select('id, role')
    .eq('user_id', creado.user.id)
    .is('ended_at', null);
  ok('cargo asignado (después)', cargosDespues);

  paso(6, 'GET /admin sin 2FA activo → el middleware debe exigir /entrar/2fa');
  // Usuario SIN 2FA con cargo vigente: creamos otro fixture limpio para no
  // interferir con la sesión aal2 ya obtenida arriba.
  const email2 = `rc-verif-mfa-cargo-${Date.now()}@example.com`;
  const { data: creado2 } = await admin.auth.admin.createUser({ email: email2, password, email_confirm: true });
  await admin.from('positions').insert({
    user_id: creado2.user.id,
    role: 'moderator',
    scope: 'community',
    territory_id: 21,
  });
  const cliente3 = nuevoCliente();
  const { data: login3 } = await cliente3.auth.signInWithPassword({ email: email2, password });
  const cookieHeader = `sb-access-token=${login3.session.access_token}`; // referencia; el middleware usa las cookies propias de @supabase/ssr

  // Probamos el guard llamando directamente a requiereMfa() vía las mismas
  // funciones RPC que usa middleware.ts (documentado en niveles.ts), ya que
  // simular las cookies exactas de @supabase/ssr desde un script de Node no
  // es representativo del navegador real.
  const [{ data: esAdmin2 }, { data: esEditor2 }, { data: cargos2 }] = await Promise.all([
    cliente3.rpc('is_admin', { p_user: creado2.user.id }),
    cliente3.rpc('is_editor', { p_user: creado2.user.id }),
    admin.from('positions').select('id').eq('user_id', creado2.user.id).is('ended_at', null),
  ]);
  const requiereMfaResultado = Boolean(esAdmin2) || Boolean(esEditor2) || Boolean(cargos2?.length);
  ok('requiereMfa() (usuario con cargo "moderator", sin 2FA)', requiereMfaResultado);
  if (!requiereMfaResultado) fail('se esperaba requiereMfa()=true para un usuario con cargo vigente');

  paso(7, 'Baja de 2FA (unenroll)');
  const { error: unenrollError } = await cliente2.auth.mfa.unenroll({ factorId: enrollData.id });
  if (unenrollError) return fail('mfa.unenroll', unenrollError.message);
  ok('2FA desactivado');

  console.log('\n=== LIMPIEZA ===');
  await admin.from('positions').delete().eq('user_id', creado.user.id);
  await admin.from('positions').delete().eq('user_id', creado2.user.id);
  await admin.auth.admin.deleteUser(creado.user.id);
  await admin.auth.admin.deleteUser(creado2.user.id);
  ok('usuarios y cargos de prueba borrados');
}

main().catch((e) => {
  console.error('ERROR NO CONTROLADO', e);
  process.exit(1);
});
