import { test, expect } from '@playwright/test';

/**
 * Home — la página que más gente ve. Carga (200), tiene su h1 de marca y el
 * andamiaje de layout (nav + footer) que rc-04 fija desde el boceto 4.
 */
test.describe('Home @publico', () => {
  test('carga con 200, h1 de marca y layout', async ({ page }) => {
    const res = await page.goto('/');
    expect(res?.status(), 'la home debe responder 200').toBe(200);

    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toBeVisible();
    await expect(h1).toContainText('Razón Común');

    // Título de pestaña con la marca (SEO técnico de rc-04).
    await expect(page).toHaveTitle(/Razón Común/);

    // Andamiaje: navegación principal y pie.
    await expect(page.locator('nav').first()).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();
  });

  test('el enlace del logo lleva a la propia home', async ({ page }) => {
    await page.goto('/');
    const logo = page.getByRole('link', { name: 'Razón Común' }).first();
    await expect(logo).toHaveAttribute('href', '/');
  });
});
