import { test, expect } from '@playwright/test';
import { AUTH_FILE, haySesion, MOTIVO_SIN_SESION } from '../fixtures';

/**
 * Perfil — la REGRESIÓN del bug de 3 capas (commit 546437f): al guardar
 * nombre + provincia debe verse "Guardado" y el <select> de provincia debe
 * CONSERVAR el valor elegido tras guardar. La 3ª capa del bug solo se veía en
 * un navegador real: por eso este spec vive aquí y no en la suite de fetch.
 *
 * Requiere una sesión válida en el navegador. Sin ella, se salta con motivo
 * explícito (NO se borra): queda listo para cuando haya storageState.
 */
// Control SIN sesión: siempre corre, no necesita storageState.
test.describe('Perfil · sin sesión @publico', () => {
  test('el middleware protege /perfil y redirige a /entrar', async ({ page }) => {
    await page.goto('/perfil');
    await expect(page).toHaveURL(/\/entrar\?next=%2Fperfil/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Entrar');
  });
});

test.describe('Perfil · con sesión @auth', () => {
  const authed = haySesion();
  test.skip(!authed, MOTIVO_SIN_SESION);
  if (authed) test.use({ storageState: AUTH_FILE });

  test('guardar nombre + provincia muestra "Guardado" y el selector conserva el valor', async ({
    page,
  }) => {
    await page.goto('/perfil');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mi perfil');

    // Nombre.
    const nombre = page.getByLabel(/nombre/i).first();
    await nombre.fill('QA Nombre de Prueba');

    // Provincia: elegir una opción no vacía (la segunda del <select>).
    const provincia = page.locator('select').first();
    const valorElegido = await provincia
      .locator('option')
      .nth(1)
      .getAttribute('value');
    await provincia.selectOption(valorElegido!);

    // Guardar.
    await page.getByRole('button', { name: /guardar/i }).click();

    // Feedback de éxito.
    await expect(page.getByText(/guardado/i)).toBeVisible();

    // La 3ª capa del bug: el selector NO debe revertir a vacío tras guardar.
    await expect(provincia).toHaveValue(valorElegido!);

    // Y persiste tras recargar (el valor guardado vuelve del servidor).
    await page.reload();
    await expect(page.locator('select').first()).toHaveValue(valorElegido!);
  });
});
