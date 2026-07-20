import { test, expect } from '@playwright/test';

/**
 * Menú móvil (rc-04) — a 390 px el burger aparece y abre un overlay a pantalla
 * completa con los enlaces de navegación y la fila de redes sociales.
 *
 * Doble resiliencia pedida por el encargo:
 *  1. Solo aplica en viewport móvil (<960 px): en escritorio se salta.
 *  2. Si rc-04 aún NO está desplegado en el entorno bajo prueba (el burger no
 *     está en el HTML), se salta con motivo — NO se borra el spec.
 */
test.describe('Menú móvil @movil', () => {
  test('el burger abre el overlay con enlaces y redes', async ({ page }, testInfo) => {
    const ancho = page.viewportSize()?.width ?? 0;
    test.skip(ancho >= 960, 'El menú móvil solo existe por debajo de 960 px.');

    await page.goto('/');
    const burger = page.getByRole('button', { name: 'Abrir menú' });

    // ¿Desplegado? Si el burger no existe, rc-04 aún no está en este entorno.
    if ((await burger.count()) === 0) {
      test.skip(true, 'Menú móvil (rc-04) aún no desplegado en el entorno bajo prueba.');
    }

    await expect(burger).toBeVisible();
    await burger.click();

    // Overlay fullscreen como diálogo modal.
    const overlay = page.locator('#menu-movil');
    await expect(overlay).toBeVisible();
    await expect(overlay).toHaveAttribute('role', 'dialog');

    // Enlaces principales de navegación dentro del overlay.
    await expect(overlay.getByRole('link', { name: 'Manifiesto' })).toBeVisible();
    await expect(overlay.getByRole('link', { name: 'Blog' })).toBeVisible();

    // Fila de redes sociales (enlaces con aria-label "Síguenos en …" / "Únete …").
    const redes = overlay.locator('a[target="_blank"]');
    expect(await redes.count(), 'debe haber enlaces de redes en el overlay').toBeGreaterThan(2);

    // Cierra con Escape.
    await page.keyboard.press('Escape');
    await expect(overlay).toHaveCount(0);
  });
});
