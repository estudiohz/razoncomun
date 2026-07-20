#!/usr/bin/env node
/**
 * Simula el webhook de Stripe Identity contra MI PROPIA route handler
 * (/api/stripe/identity/webhook) corriendo en local. Genera una firma
 * Stripe-Signature válida con el helper oficial del SDK (criptografía
 * local, no requiere red ni clave real de Stripe) usando el mismo
 * STRIPE_IDENTITY_WEBHOOK_SECRET que tiene la app en .env.local.
 */
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const APP_URL = 'http://localhost:3000';
const WEBHOOK_SECRET = 'whsec_dev_local_a8e1d6b8610de115325379dfb01c4fd3a0c6528e87d79379';
const SUPABASE_URL = 'https://dev-api.razoncomun.com';
const SERVICE_ROLE_KEY = process.env.RC_SERVICE_ROLE_KEY;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ok = (t, d) => console.log('OK  ' + t, d ?? '');
const fail = (t, d) => {
  console.log('FAIL ' + t, d ?? '');
  process.exitCode = 1;
};

function firmar(payloadObj) {
  const payload = JSON.stringify(payloadObj);
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
  return { payload, header };
}

async function enviar(payloadObj, { firmaValida = true } = {}) {
  const { payload, header } = firmar(payloadObj);
  const stripeSignature = firmaValida ? header : header.replace(/v1=[a-f0-9]+/, 'v1=firmamanipulada00000000000000000000000000000000000000000000000000');
  const res = await fetch(`${APP_URL}/api/stripe/identity/webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': stripeSignature },
    body: payload,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function main() {
  const email = `rc-verif-identity-${Date.now()}@example.com`;
  const { data: creado } = await admin.auth.admin.createUser({ email, password: 'PruebaSegura!2026x', email_confirm: true });
  await admin.from('profiles').update({ level: 'member', member_since: new Date().toISOString() }).eq('id', creado.user.id);
  ok('usuario de prueba creado con level=member', creado.user.id);

  const eventId = `evt_test_${Date.now()}`;
  const sessionId = `vs_test_${Date.now()}`;
  const eventoVerificado = {
    id: eventId,
    object: 'event',
    type: 'identity.verification_session.verified',
    data: {
      object: {
        id: sessionId,
        object: 'identity.verification_session',
        status: 'verified',
        metadata: { user_id: creado.user.id },
      },
    },
  };

  console.log('\n=== 1. Rechazo: firma inválida ===');
  const rFirmaMala = await enviar(eventoVerificado, { firmaValida: false });
  ok('POST webhook con firma manipulada', rFirmaMala);
  if (rFirmaMala.status !== 400) fail('se esperaba 400 con firma inválida');

  console.log('\n=== 2. Evento válido: identity.verification_session.verified ===');
  const rOk = await enviar(eventoVerificado);
  ok('POST webhook firmado correctamente', rOk);
  if (rOk.status !== 200) fail('se esperaba 200');

  const { data: perfilTrasWebhook } = await admin
    .from('profiles')
    .select('level, identity_verified_at')
    .eq('id', creado.user.id)
    .single();
  ok('profiles tras el webhook (level→verified, identity_verified_at)', perfilTrasWebhook);
  if (perfilTrasWebhook.level !== 'verified') fail('se esperaba level=verified');

  console.log('\n=== 3. Idempotencia: reenviar el MISMO evento ===');
  const { data: countAntes } = await admin
    .from('audit_log')
    .select('id', { count: 'exact', head: false })
    .eq('entity', 'stripe_identity_event')
    .eq('meta->>stripe_event_id', eventId);
  const rRepetido = await enviar(eventoVerificado);
  ok('POST webhook reenviado (mismo event.id)', rRepetido);
  const { data: countDespues } = await admin
    .from('audit_log')
    .select('id')
    .eq('entity', 'stripe_identity_event')
    .eq('meta->>stripe_event_id', eventId);
  ok('filas en audit_log para este event.id (debe seguir siendo 1, no 2)', countDespues?.length);
  if ((countDespues?.length ?? 0) !== 1) fail('idempotencia rota: se procesó más de una vez');
  if (!rRepetido.body?.idempotente) fail('se esperaba idempotente:true en la respuesta del reenvío');

  console.log('\n=== 4. Evento de estado intermedio: requires_input (no cambia el nivel) ===');
  const eventId2 = `evt_test_reqinput_${Date.now()}`;
  const eventoRequiresInput = {
    id: eventId2,
    object: 'event',
    type: 'identity.verification_session.requires_input',
    data: {
      object: {
        id: sessionId,
        object: 'identity.verification_session',
        status: 'requires_input',
        metadata: { user_id: creado.user.id },
        last_error: { reason: 'document_expired' },
      },
    },
  };
  const rReqInput = await enviar(eventoRequiresInput);
  ok('POST requires_input', rReqInput);

  console.log('\n=== LIMPIEZA ===');
  await admin.auth.admin.deleteUser(creado.user.id);
  ok('usuario de prueba borrado');
}

main().catch((e) => {
  console.error('ERROR NO CONTROLADO', e);
  process.exit(1);
});
