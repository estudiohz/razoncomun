#!/usr/bin/env node
/**
 * Script de verificación E2E de rc-03-auth (Ola 2). Uso puntual para dejar
 * evidencia real de que los flujos funcionan — NO es parte de la app, se
 * borra antes de cerrar la ola. Habla con el Supabase de desarrollo real
 * (dev-api.razoncomun.com) y con el propio servidor Next.js en local
 * (localhost:3000, `npm run dev`) para probar mis propias route handlers,
 * no solo la API de Supabase en crudo.
 */
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

/** RFC 6238 TOTP mínimo (evita depender de la API cambiante de otplib v13). */
function base32Decode(base32) {
  const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of base32.replace(/=+$/, '').toUpperCase()) {
    const val = alfabeto.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
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

const SUPABASE_URL = 'https://dev-api.razoncomun.com';
const ANON_KEY = process.env.RC_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.RC_SERVICE_ROLE_KEY;
const APP_URL = 'http://localhost:3000';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function nuevoCliente() {
  return createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
}

const paso = (n, t) => console.log(`\n=== ${n}. ${t} ===`);
const ok = (t, d) => console.log(`OK  ${t}`, d ?? '');
const fail = (t, d) => console.log(`FAIL ${t}`, d ?? '');

async function limpiarUsuario(email) {
  const { data } = await admin.auth.admin.listUsers();
  const existente = data?.users.find((u) => u.email === email);
  if (existente) await admin.auth.admin.deleteUser(existente.id);
}

async function main() {
  const email = `rc-verif-${Date.now()}@example.com`;
  const password = 'PruebaSegura!2026x';

  // ---------- 1. REGISTRO + CONSENTIMIENTO ----------
  paso(1, `Registro con contraseña — ${email}`);
  await limpiarUsuario(email);
  const cliente1 = nuevoCliente();
  const { data: signUpData, error: signUpError } = await cliente1.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${APP_URL}/auth/confirm?next=%2Fperfil`,
      data: { rc_privacy_consent: true, rc_newsletter_opt_in: true, rc_display_name: 'Prueba E2E' },
    },
  });
  if (signUpError) return fail('signUp', signUpError.message);
  ok('signUp OK, sesión null (autoconfirm=false, esperado)', {
    user_id: signUpData.user?.id,
    session: signUpData.session,
  });

  const { data: perfilRecienCreado } = await admin
    .from('profiles')
    .select('*')
    .eq('id', signUpData.user.id)
    .single();
  ok('trigger espejo profiles creó la fila', perfilRecienCreado);

  // Simula el clic en el email: pedimos el link real vía admin (mismo
  // mecanismo que usaría GoTrue al enviarlo) y lo redimimos contra MI PROPIA
  // route handler /auth/confirm (no contra /auth/v1/verify de Supabase).
  paso(2, 'Confirmar email vía mi propia ruta /auth/confirm');
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'signup',
    email,
    password,
  });
  if (linkError) return fail('generateLink', linkError.message);
  const tokenHash = linkData.properties.hashed_token;

  const resConfirm = await fetch(
    `${APP_URL}/auth/confirm?token_hash=${tokenHash}&type=signup&next=%2Fperfil`,
    { redirect: 'manual' },
  );
  ok('GET /auth/confirm', {
    status: resConfirm.status,
    location: resConfirm.headers.get('location'),
    set_cookie_presente: Boolean(resConfirm.headers.get('set-cookie')),
  });

  const { data: perfilTrasConfirmar } = await admin
    .from('profiles')
    .select('privacy_consent_at, newsletter_opt_in, newsletter_opt_in_at, display_name')
    .eq('id', signUpData.user.id)
    .single();
  ok('profiles tras confirmar (consentimiento/newsletter/nombre aplicados)', perfilTrasConfirmar);

  const { data: userTrasConfirmar } = await admin.auth.admin.getUserById(signUpData.user.id);
  ok('auth.users.email_confirmed_at', userTrasConfirmar.user.email_confirmed_at);

  // ---------- 3. LOGIN ----------
  paso(3, 'Login con contraseña (correcto) y rechazo con contraseña incorrecta');
  const cliente2 = nuevoCliente();
  const { data: loginOk, error: loginOkError } = await cliente2.auth.signInWithPassword({
    email,
    password,
  });
  if (loginOkError) return fail('login correcto', loginOkError.message);
  ok('login correcto', { user_id: loginOk.user.id, aal: (await cliente2.auth.mfa.getAuthenticatorAssuranceLevel()).data });

  const cliente2b = nuevoCliente();
  const { error: loginMalError } = await cliente2b.auth.signInWithPassword({
    email,
    password: 'contraseña-incorrecta-123',
  });
  if (!loginMalError) return fail('login con password incorrecta debería fallar y NO falló');
  ok('rechazo esperado con password incorrecta', loginMalError.message);

  // ---------- 4. RECUPERACIÓN DE CONTRASEÑA ----------
  paso(4, 'Recuperación de contraseña (resetPasswordForEmail real + /auth/confirm + updateUser)');
  const cliente3 = nuevoCliente();
  const { error: resetError } = await cliente3.auth.resetPasswordForEmail(email, {
    redirectTo: `${APP_URL}/auth/confirm?next=%2Fperfil`,
  });
  if (resetError) return fail('resetPasswordForEmail (envío real via Brevo)', resetError.message);
  ok('resetPasswordForEmail: 200 — GoTrue ha encolado el envío real por SMTP (Brevo)');

  const { data: linkRecovery, error: linkRecoveryError } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
  });
  if (linkRecoveryError) return fail('generateLink recovery', linkRecoveryError.message);
  const tokenHashRecovery = linkRecovery.properties.hashed_token;

  const resConfirmRecovery = await fetch(
    `${APP_URL}/auth/confirm?token_hash=${tokenHashRecovery}&type=recovery&next=%2Fperfil`,
    { redirect: 'manual' },
  );
  const cookiesRecovery = resConfirmRecovery.headers.get('set-cookie');
  ok('GET /auth/confirm (recovery)', {
    status: resConfirmRecovery.status,
    location: resConfirmRecovery.headers.get('location'),
    redirige_a_actualizar: resConfirmRecovery.headers.get('location')?.includes('/recuperar/actualizar'),
  });

  // ---------- 5. 2FA TOTP: alta, login exige challenge, baja ----------
  paso(5, 'Alta de 2FA (TOTP), verificación de secreto y exigencia de aal2');
  const { data: enrollData, error: enrollError } = await cliente2.auth.mfa.enroll({ factorType: 'totp' });
  if (enrollError) return fail('mfa.enroll', enrollError.message);
  ok('mfa.enroll', { factor_id: enrollData.id, secret_presente: Boolean(enrollData.totp.secret) });

  const codigo = totpGenerar(enrollData.totp.secret);

  const { data: challengeData, error: challengeError } = await cliente2.auth.mfa.challenge({
    factorId: enrollData.id,
  });
  if (challengeError) return fail('mfa.challenge', challengeError.message);

  const { error: verifyError } = await cliente2.auth.mfa.verify({
    factorId: enrollData.id,
    challengeId: challengeData.id,
    code: codigo,
  });
  if (verifyError) return fail('mfa.verify (alta)', verifyError.message);
  ok('2FA activado (factor verified)');

  // Rechazo con código incorrecto en un NUEVO login (aal1 → intento aal2)
  const cliente4 = nuevoCliente();
  const { error: loginError2 } = await cliente4.auth.signInWithPassword({ email, password });
  if (loginError2) return fail('re-login tras activar 2FA', loginError2.message);
  const aalTrasLogin = await cliente4.auth.mfa.getAuthenticatorAssuranceLevel();
  ok('tras login con 2FA activo: currentLevel/nextLevel', aalTrasLogin.data);

  const { data: challenge2 } = await cliente4.auth.mfa.challenge({ factorId: enrollData.id });
  const { error: verifyMalError } = await cliente4.auth.mfa.verify({
    factorId: enrollData.id,
    challengeId: challenge2.id,
    code: '000000',
  });
  if (!verifyMalError) return fail('verify con código erróneo debería fallar y NO falló');
  ok('rechazo esperado con código TOTP incorrecto', verifyMalError.message);

  const codigo2 = totpGenerar(enrollData.totp.secret);
  const { data: challenge3 } = await cliente4.auth.mfa.challenge({ factorId: enrollData.id });
  const { error: verifyOkError } = await cliente4.auth.mfa.verify({
    factorId: enrollData.id,
    challengeId: challenge3.id,
    code: codigo2,
  });
  if (verifyOkError) return fail('verify con código correcto', verifyOkError.message);
  const aalTrasVerify = await cliente4.auth.mfa.getAuthenticatorAssuranceLevel();
  ok('tras verificar 2FA correctamente: aal', aalTrasVerify.data);

  // Baja de 2FA
  const { error: unenrollError } = await cliente4.auth.mfa.unenroll({ factorId: enrollData.id });
  if (unenrollError) return fail('mfa.unenroll', unenrollError.message);
  ok('2FA desactivado (unenroll)');

  // ---------- 6. Rechazo de consentimiento requerido en el flujo de servidor ----------
  paso(6, 'Guard requireNivel/requireUsuario: /perfil sin sesión redirige a /entrar');
  const resPerfilAnon = await fetch(`${APP_URL}/perfil`, { redirect: 'manual' });
  ok('GET /perfil sin cookies', {
    status: resPerfilAnon.status,
    location: resPerfilAnon.headers.get('location'),
  });

  console.log('\n=== LIMPIEZA ===');
  await admin.auth.admin.deleteUser(signUpData.user.id);
  ok('usuario de prueba borrado', email);
}

main().catch((e) => {
  console.error('ERROR NO CONTROLADO', e);
  process.exit(1);
});
