import { test, expect, type Page } from '@playwright/test';
import { primerArticuloEditorial } from '../fixtures';

/**
 * Regresión VISUAL — baselines de home, blog y entrada (desktop + móvil, un
 * baseline por proyecto). Si un cambio de CSS rompe el diseño del boceto, el
 * diff sale en rojo sin que nadie tenga que mirarlo a ojo.
 *
 * Estabilidad contra un sitio en vivo:
 *  - animaciones desactivadas (config global toHaveScreenshot).
 *  - se enmascara lo genuinamente dinámico: el vídeo del hero, el rotatorio de
 *    slogans y las imágenes remotas (portadas de artículo, que pueden cambiar).
 *  - se espera a fuentes + red en reposo antes de capturar.
 *
 * Regenerar baselines tras un cambio de diseño intencionado:
 *   npx playwright test visual --update-snapshots
 */

async function estabilizar(page: Page) {
  await page.waitForLoadState('networkidle').catch(() => {});
  // Fuentes cargadas: evita reflow de Montserrat entre captura y verificación.
  await page.evaluate(() => (document as unknown as { fonts: FontFaceSet }).fonts.ready);
  await page.waitForTimeout(400);
}

test.describe('Regresión visual @visual', () => {
  test('home', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await estabilizar(page);
    await expect(page).toHaveScreenshot('home.png', {
      fullPage: true,
      mask: [page.locator('video'), page.locator('.rota')],
    });
  });

  test('blog portada', async ({ page }) => {
    await page.goto('/blog', { waitUntil: 'domcontentloaded' });
    await estabilizar(page);
    await expect(page).toHaveScreenshot('blog.png', {
      fullPage: true,
      // Portadas de artículo remotas → enmascaradas (el layout sí se compara).
      mask: [page.locator('img')],
    });
  });

  test('entrada individual', async ({ page }) => {
    const href = await primerArticuloEditorial(page);
    test.skip(!href, 'No hay artículos publicados en el entorno bajo prueba.');
    await page.goto(href!, { waitUntil: 'domcontentloaded' });
    await estabilizar(page);
    await expect(page).toHaveScreenshot('entrada.png', {
      fullPage: true,
      mask: [page.locator('img')],
    });
  });
});
