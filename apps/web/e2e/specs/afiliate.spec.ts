import { test, expect } from '@playwright/test';
import { AUTH_FILE, haySesion, MOTIVO_SIN_SESION } from '../fixtures';

/**
 * Afiliación — la fuga que se verificó: /afiliate SIN sesión NO debe exponer
 * el formulario de domiciliación (NIF/IBAN). Debe mostrar la escalera de
 * niveles y el CTA a entrar. Con sesión, aparecen los dos planes.
 */
test.describe('Afiliación · anónimo @publico', () => {
  test('muestra la escalera + CTA a entrar, y NO el formulario NIF/IBAN', async ({ page }) => {
    const res = await page.goto('/afiliate');
    expect(res?.status()).toBe(200);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Convierte tu cuota en una política mejor',
    );

    // Escalera de 3 niveles.
    await expect(page.getByRole('heading', { name: 'Registrado' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Afiliado', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Afiliado verificado' })).toBeVisible();

    // CTA a entrar, con el next correcto.
    const cta = page.getByRole('link', { name: 'Entra o regístrate para afiliarte' });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', '/entrar?next=/afiliate');

    // NO debe filtrarse el formulario de domiciliación (regresión de la fuga):
    // ni el campo NIF/NIE, ni la etiqueta IBAN, ni los selectores de plan.
    await expect(page.getByText('Tu NIF o NIE')).toHaveCount(0);
    await expect(page.getByText(/IBAN/i)).toHaveCount(0);
    await expect(page.getByText('Continuar con tu IBAN')).toHaveCount(0);
  });
});

test.describe('Afiliación · con sesión @auth', () => {
  const authed = haySesion();
  test.skip(!authed, MOTIVO_SIN_SESION);
  if (authed) test.use({ storageState: AUTH_FILE });

  test('muestra los dos planes (Mensual / Anual)', async ({ page }) => {
    await page.goto('/afiliate');
    // Un usuario NO afiliado ve el bloque "Elige tu cuota" con los dos planes.
    // (Un usuario ya afiliado vería "Ya eres afiliado/a" — también válido.)
    const yaAfiliado = await page.getByText('Ya eres afiliado/a').count();
    test.skip(yaAfiliado > 0, 'La sesión provista ya está afiliada; no procede el alta.');

    await expect(page.getByText('Mensual')).toBeVisible();
    await expect(page.getByText(/Anual/)).toBeVisible();
    await expect(page.getByText('Tu NIF o NIE')).toBeVisible();
  });
});
