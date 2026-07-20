#!/usr/bin/env node
/**
 * Verificación real de UI del bug reportado por Sergio en /perfil (guardado
 * "no hacía nada" + selector se reseteaba). Usa Playwright (Chromium real,
 * no la extensión de Chrome MCP — que en esta sesión falla por completo con
 * "Script injection timed out" incluso en pestañas ya cargadas ajenas a esta
 * app, ver informe) contra el servidor de producción local
 * (`npm run start`, puerto 3000) hablando con el Supabase de desarrollo
 * REAL (dev-api.razoncomun.com).
 */
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const APP_URL = 'http://localhost:3000';
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

async function main() {
  const email = `rc-verif-perfilbug-${Date.now()}@example.com`;
  const { data: creado, error: creadoError } = await admin.auth.admin.createUser({
    email,
    password: 'PruebaSegura!2026x',
    email_confirm: true,
  });
  if (creadoError) return fail('admin.createUser', creadoError.message);
  ok('usuario de prueba creado y confirmado', { id: creado.user.id, email });

  // Estado inicial DELIBERADO distinto del que vamos a guardar, para poder
  // comprobar que lo que aparece en pantalla después es lo NUEVO, no un
  // resto del valor anterior.
  await admin.from('profiles').update({
    display_name: 'Nombre Viejo',
    origin_province_id: 21, // Albacete
    privacy_consent_at: new Date().toISOString(), // evita el gate de consentimiento, ya probado aparte
  }).eq('id', creado.user.id);

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (linkError) return fail('generateLink', linkError.message);
  const tokenHash = linkData.properties.hashed_token;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('console', (msg) => console.log('[browser]', msg.text()));

  console.log('\n=== 1. Sesión real en el navegador vía /auth/confirm ===');
  await page.goto(
    `${APP_URL}/auth/confirm?token_hash=${tokenHash}&type=magiclink&next=%2Fperfil`,
    { waitUntil: 'networkidle' },
  );
  ok('URL tras el confirm', page.url());
  if (!page.url().includes('/perfil')) {
    await page.screenshot({ path: 'scripts/_shot-tras-confirm.png' });
    return fail('esperaba aterrizar en /perfil', page.url());
  }

  console.log('\n=== 2. Estado inicial visible en /perfil ===');
  await page.waitForSelector('#display_name');
  const nombreInicial = await page.inputValue('#display_name');
  const provinciaInicial = await page.inputValue('#origin_province_id');
  ok('valores iniciales en el formulario', { nombreInicial, provinciaInicial });
  await page.screenshot({ path: 'scripts/_shot-1-antes.png', fullPage: true });

  console.log('\n=== 3. Rellenar y guardar (nombre nuevo + Navarra) ===');
  await page.fill('#display_name', 'Sergio');
  await page.selectOption('#origin_province_id', { label: 'Navarra' });
  const valorSeleccionadoAntesDeGuardar = await page.inputValue('#origin_province_id');
  ok('provincia seleccionada en el <select> antes de guardar', valorSeleccionadoAntesDeGuardar);

  await page.click('button:has-text("Guardar cambios")');

  console.log('\n=== 4. Feedback visible tras guardar ===');
  const feedback = await page.waitForSelector('[role="status"]', { timeout: 10000 });
  const textoFeedback = (await feedback.textContent())?.trim();
  ok('texto del aviso de feedback', textoFeedback);
  if (!/guardado/i.test(textoFeedback ?? '')) {
    fail('se esperaba un aviso de "Guardado"', textoFeedback);
  }

  const nombreTrasGuardar = await page.inputValue('#display_name');
  const provinciaTrasGuardar = await page.inputValue('#origin_province_id');
  const etiquetaProvinciaTrasGuardar = await page.$eval(
    '#origin_province_id',
    (el) => el.options[el.selectedIndex]?.textContent,
  );
  ok('valores en el formulario DESPUÉS de guardar (deben seguir siendo los nuevos, no resetearse)', {
    nombreTrasGuardar,
    provinciaTrasGuardar,
    etiquetaProvinciaTrasGuardar,
  });
  await page.screenshot({ path: 'scripts/_shot-2-despues.png', fullPage: true });

  if (nombreTrasGuardar !== 'Sergio') fail('el nombre se reseteó tras guardar', nombreTrasGuardar);
  if (etiquetaProvinciaTrasGuardar !== 'Navarra') {
    fail('el selector de provincia se reseteó tras guardar', etiquetaProvinciaTrasGuardar);
  }

  console.log('\n=== 5. Persistencia real en BD (no solo en pantalla) ===');
  const { data: perfilBD } = await admin
    .from('profiles')
    .select('display_name, origin_province_id')
    .eq('id', creado.user.id)
    .single();
  ok('fila profiles en BD tras el guardado', perfilBD);
  if (perfilBD.display_name !== 'Sergio' || perfilBD.origin_province_id !== 50) {
    fail('la BD no refleja lo guardado (Navarra = territories.id 50)', perfilBD);
  }

  console.log('\n=== 6. Recarga completa de la página: sigue estando lo guardado ===');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#display_name');
  const nombreTrasRecargar = await page.inputValue('#display_name');
  const etiquetaProvinciaTrasRecargar = await page.$eval(
    '#origin_province_id',
    (el) => el.options[el.selectedIndex]?.textContent,
  );
  ok('valores tras recargar la página (fuente: Server Component fresco)', {
    nombreTrasRecargar,
    etiquetaProvinciaTrasRecargar,
  });

  await browser.close();

  console.log('\n=== LIMPIEZA ===');
  await admin.auth.admin.deleteUser(creado.user.id);
  ok('usuario de prueba borrado');
}

main().catch((e) => {
  console.error('ERROR NO CONTROLADO', e);
  process.exit(1);
});
