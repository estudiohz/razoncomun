import { test, expect } from '@playwright/test';
import { AUTH_FILE, haySesion, MOTIVO_SIN_SESION } from '../fixtures';

/**
 * Alta de socio — la fuga que se verificó: /unete SIN sesión NO debe exponer
 * el formulario de domiciliación (NIF/IBAN). Debe mostrar la escalera de
 * niveles y el CTA a entrar. Con sesión, aparecen los dos planes.
 */
test.describe('Socios · anónimo @publico', () => {
  test('muestra la escalera + CTA a entrar, y NO el formulario NIF/IBAN', async ({ page }) => {
    const res = await page.goto('/unete');
    expect(res?.status()).toBe(200);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Convierte tu cuota en una política mejor',
    );

    // Escalera de 3 niveles.
    await expect(page.getByRole('heading', { name: 'Registrado' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Socio', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Socio verificado' })).toBeVisible();

    // CTA a entrar, con el next correcto.
    const cta = page.getByRole('link', { name: 'Entra o regístrate para hacerte socio' });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', '/entrar?next=/unete');

    // NO debe filtrarse el formulario de domiciliación (regresión de la fuga):
    // ni el campo NIF/NIE, ni la etiqueta IBAN, ni los selectores de plan.
    await expect(page.getByText('Tu NIF o NIE')).toHaveCount(0);
    await expect(page.getByText(/IBAN/i)).toHaveCount(0);
    await expect(page.getByText('Continuar con tu IBAN')).toHaveCount(0);
  });
});

test.describe('Socios · con sesión @auth', () => {
  const authed = haySesion();
  test.skip(!authed, MOTIVO_SIN_SESION);
  if (authed) test.use({ storageState: AUTH_FILE });

  test('muestra los dos planes (Mensual / Anual)', async ({ page }) => {
    await page.goto('/unete');
    // Un usuario que NO es socio ve el bloque "Elige tu cuota" con los dos planes.
    // (Un usuario que ya es socio vería "Ya eres socio/a" — también válido.)
    const yaSocio = await page.getByText('Ya eres socio/a').count();
    test.skip(yaSocio > 0, 'La sesión provista ya es socia; no procede el alta.');

    await expect(page.getByText('Mensual')).toBeVisible();
    await expect(page.getByText(/Anual/)).toBeVisible();
    await expect(page.getByText('Tu NIF o NIE')).toBeVisible();
  });
});
