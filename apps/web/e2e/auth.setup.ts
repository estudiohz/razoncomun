import { test as setup, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { AUTH_FILE } from './fixtures';

/**
 * Genera el storageState de sesión que consumen los specs autenticados
 * (perfil, afiliación con sesión, admin no-admin).
 *
 * Se ejecuta con el proyecto `setup`:
 *   E2E_EMAIL=... E2E_PASSWORD=... npx playwright test --project=setup
 *
 * Sin credenciales, se SALTA (no falla): los flujos autenticados quedan en skip
 * honesto. Las credenciales llegan SOLO por entorno — nunca al repo.
 *
 * Nota: si la cuenta tiene 2FA activo, el login queda en aal1 y no elevará a
 * aal2 (haría falta el código TOTP). Para el panel admin con 2FA, ver el
 * test.skip declarado en admin.spec.ts.
 */
setup('crear sesión de test (si hay credenciales)', async ({ page }) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  setup.skip(
    !email || !password,
    'Define E2E_EMAIL y E2E_PASSWORD para generar una sesión de navegador.',
  );

  await page.goto('/entrar');
  await page.locator('#email').fill(email!);
  await page.locator('#password').fill(password!);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();

  // El login lleva a /perfil (o a /entrar/2fa si hay MFA pendiente).
  await page.waitForURL(/\/perfil|\/entrar\/2fa/, { timeout: 20_000 });
  if (/\/entrar\/2fa/.test(page.url())) {
    setup.skip(true, 'La cuenta exige 2FA (aal2): no se puede completar sin el código TOTP.');
  }
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  await page.context().storageState({ path: AUTH_FILE });
});
