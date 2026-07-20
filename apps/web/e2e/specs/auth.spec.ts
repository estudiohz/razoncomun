import { test, expect } from '@playwright/test';

/**
 * Autenticación — cubre lo alcanzable SIN buzón de correo real:
 *  - /entrar renderiza el modo "enlace mágico".
 *  - /auth/confirm con token inválido redirige al ORIGEN PÚBLICO (regresión
 *    real: antes redirigía a https://0.0.0.0:3000, commit a6ec55f).
 *
 * El viaje completo del enlace mágico (recibir el correo y pinchar el enlace)
 * NO es alcanzable sin un buzón de prueba → queda como test.skip explícito.
 */
test.describe('Auth · enlace mágico @auth @publico', () => {
  test('/entrar renderiza el modo enlace mágico', async ({ page }) => {
    const res = await page.goto('/entrar');
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Entrar');

    // Cambiar a modo mágico: desaparece la contraseña, el botón cambia de texto.
    await page.getByRole('button', { name: 'Enlace mágico' }).click();
    await expect(page.getByRole('button', { name: 'Enviarme el enlace' })).toBeVisible();
    await expect(page.locator('#password')).toHaveCount(0);
    await expect(page.locator('#email')).toBeVisible();
  });

  test('/auth/confirm con token inválido redirige al origen público (no 0.0.0.0)', async ({
    page,
    baseURL,
  }) => {
    await page.goto('/auth/confirm?token_hash=token_invalido_de_test&type=magiclink');

    // Aterriza en /entrar con el error, y en el MISMO host público — nunca
    // 0.0.0.0 ni el hostname interno del contenedor.
    await expect(page).toHaveURL(/\/entrar\?error=enlace_invalido/);
    const origen = new URL(baseURL!).origin;
    expect(page.url().startsWith(origen), `debe quedarse en ${origen}`).toBe(true);
    expect(page.url()).not.toContain('0.0.0.0');

    // El mensaje de enlace caducado se muestra al usuario.
    await expect(page.getByText(/enlace ya no es válido|ha caducado/i)).toBeVisible();
  });

  // No alcanzable sin buzón real: emisión del OTP + redención del enlace del correo.
  test.skip('viaje completo del enlace mágico (recibir correo y pinchar)', async () => {
    // Requiere un buzón de prueba (p. ej. Mailpit/Inbucket del stack Supabase) para
    // leer el token del correo. Cuando exista, emitir OTP en /entrar, capturar el
    // token del buzón y visitar /auth/confirm?token_hash=<real>&type=magiclink.
  });
});
