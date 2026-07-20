import { test, expect } from '@playwright/test';

/**
 * Portada del blog — carga (200), h1 esperado y al menos una ficha enlazada.
 * El h1 es texto fijo del código (rc-05), no depende de los datos.
 */
test.describe('Blog · portada @publico', () => {
  test('carga con 200 y su h1', async ({ page }) => {
    const res = await page.goto('/blog');
    expect(res?.status()).toBe(200);

    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toHaveText('Análisis por departamentos');
    await expect(page).toHaveTitle(/Blog/);
  });

  test('lista artículos con enlace a su ficha', async ({ page }) => {
    await page.goto('/blog');
    // El destacado de portada es un <article> cuyo título enlaza a /blog/[slug].
    const destacado = page.locator('article a[href^="/blog/"]').first();
    await expect(destacado, 'debe haber al menos un artículo publicado').toHaveCount(1);
    const href = await destacado.getAttribute('href');
    expect(href).toMatch(/^\/blog\/[a-z0-9-]+$/);
  });
});
