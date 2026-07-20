import fs from 'node:fs';
import path from 'node:path';

/**
 * Utilidades compartidas por los specs. CERO secretos aquí: todo lo sensible
 * (sesión de test) llega por entorno o por un fichero fuera de git (.auth/).
 */

/** Ruta del storageState de sesión. Por defecto, el que genera auth.setup.ts. */
export const AUTH_FILE =
  process.env.E2E_STORAGE_STATE ?? path.resolve(__dirname, '.auth/user.json');

/**
 * ¿Hay una sesión de navegador disponible para los flujos autenticados?
 * True si el fichero de storageState existe y no está vacío.
 */
export function haySesion(): boolean {
  try {
    return fs.existsSync(AUTH_FILE) && fs.statSync(AUTH_FILE).size > 2;
  } catch {
    return false;
  }
}

/** Motivo estándar de skip cuando no hay sesión inyectable. */
export const MOTIVO_SIN_SESION =
  'Requiere una sesión de navegador: define E2E_STORAGE_STATE, o exporta ' +
  'E2E_EMAIL/E2E_PASSWORD y ejecuta `npx playwright test --project=setup`. ' +
  'Sin ella este flujo autenticado no es alcanzable (ver e2e/README.md).';

/**
 * Localiza en /blog el enlace del artículo destacado (el <article> de portada,
 * cuyo título enlaza a /blog/[slug]). Evita confundir un artículo con un chip
 * de categoría, que también apunta a /blog/[algo] pero no es una ficha.
 * Devuelve el href relativo, o null si la portada no tiene artículos.
 */
export async function primerArticuloEditorial(
  page: import('@playwright/test').Page,
): Promise<string | null> {
  await page.goto('/blog', { waitUntil: 'domcontentloaded' });
  const destacado = page.locator('article a[href^="/blog/"]').first();
  if ((await destacado.count()) === 0) return null;
  return destacado.getAttribute('href');
}
