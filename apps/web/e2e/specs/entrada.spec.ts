import { test, expect } from '@playwright/test';
import { primerArticuloEditorial } from '../fixtures';

/**
 * Entrada individual del blog — verifica el LAYOUT NUEVO decidido por Sergio
 * (rediseño D-022, commit 6354daf): cabecera a la izquierda con el orden
 * exacto  etiqueta → título → imagen → metadatos → contenido.
 *
 * La regresión que caza: en el diseño viejo la etiqueta y los metadatos iban
 * centrados y ARRIBA de la imagen. Aquí se comprueba con geometría real del
 * navegador (bounding boxes), no leyendo el HTML: es justo la capa que un test
 * de solo-fetch no ve.
 */
test.describe('Blog · entrada individual @publico', () => {
  test('respeta el layout nuevo (etiqueta izq, metadatos bajo la imagen)', async ({
    page,
  }) => {
    const href = await primerArticuloEditorial(page);
    test.skip(!href, 'No hay artículos publicados en el entorno bajo prueba.');

    const res = await page.goto(href!);
    expect(res?.status()).toBe(200);

    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toBeVisible();

    // Bloque de metadatos de la cabecera (autor · fecha · lectura). El primero
    // en el DOM es el de la propia ficha (no el de relacionados).
    const metadatos = page.getByText(/min de lectura/).first();
    await expect(metadatos).toBeVisible();

    // El layout solo se estabiliza cuando la imagen destacada (carga asíncrona)
    // ha terminado: medir antes daba cajas a 0 (flake). Se espera load + imagen.
    await page.waitForLoadState('load');
    await page
      .locator('img[alt=""]')
      .first()
      .evaluate(
        (img: HTMLImageElement) =>
          img.complete ||
          new Promise<void>((r) => img.addEventListener('load', () => r(), { once: true })),
      )
      .catch(() => {});

    // Geometría: la etiqueta de categoría es el hermano previo del h1.
    // Se devuelven números planos: los campos de DOMRect viven en el prototipo
    // y se pierden al serializar el objeto crudo a través de evaluate().
    const rects = await page.evaluate(() => {
      const h1El = document.querySelector('h1');
      const label = h1El?.previousElementSibling as HTMLElement | null;
      // La fila de metadatos de la ficha contiene un <time> (fecha de
      // publicación). Es un ancla determinista y renderizada — a diferencia de
      // buscar el texto "min de lectura", que también aparece en los <script>
      // de datos RSC de Next (posición 0,0 → falso positivo intermitente).
      const meta = document.querySelector('time') as HTMLElement | null;
      const cover = document.querySelector('img[alt=""]') as HTMLElement | null;
      const box = (el: Element | null | undefined) => {
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { top: b.top, left: b.left, bottom: b.bottom };
      };
      return {
        h1: box(h1El),
        label: box(label),
        labelText: label?.textContent?.trim() ?? null,
        meta: box(meta),
        cover: box(cover),
      };
    });

    expect(rects.h1, 'debe existir el h1 del artículo').not.toBeNull();

    // 1) Etiqueta ANTES del título y a su MISMA sangría izquierda (izquierda,
    //    no centrada como en el diseño viejo).
    expect(rects.label, 'la etiqueta de categoría debe existir en la cabecera').not.toBeNull();
    expect(rects.label!.top).toBeLessThanOrEqual(rects.h1.top + 2);
    expect(
      Math.abs(rects.label!.left - rects.h1.left),
      'etiqueta y título deben compartir el margen izquierdo',
    ).toBeLessThan(40);

    // 2) Si hay imagen destacada: orden título → imagen → metadatos.
    if (rects.cover) {
      expect(rects.cover.top, 'la imagen va debajo del título').toBeGreaterThan(rects.h1.top);
      expect(
        rects.meta!.top,
        'los metadatos van DEBAJO de la imagen (decisión de Sergio)',
      ).toBeGreaterThan(rects.cover.top);
    } else {
      // Sin imagen, al menos los metadatos siguen por debajo del título.
      expect(rects.meta!.top).toBeGreaterThan(rects.h1.top);
    }
  });
});
