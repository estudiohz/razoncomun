import { defineConfig, devices } from '@playwright/test';

/**
 * Suite E2E de navegador de Razón Común — capa de navegador (Chromium propio),
 * complemento de `scripts/smoke/` (Python: base + API + RLS).
 *
 * Prueba los flujos de usuario REALES que Sergio recorre a mano y que ningún
 * test cubría: home/blog/entrada, login por enlace mágico, perfil, afiliación,
 * admin, menú móvil y regresión visual contra el boceto.
 *
 * Parametrizada 100% por entorno — CERO secretos en el repo (público):
 *   E2E_BASE_URL       URL a probar          (default https://dev.razoncomun.com)
 *   E2E_STORAGE_STATE  storageState de sesión (opcional; ver e2e/README.md)
 *   E2E_EMAIL/E2E_PASSWORD  credenciales para auth.setup.ts (opcional)
 *
 * Subconjuntos con el `--grep` nativo, p. ej.:
 *   npx playwright test --grep @visual
 *   npx playwright test --project=desktop --grep-invert @auth
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'https://dev.razoncomun.com';
const enCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: '.',
  // Todo el output de Playwright se queda DENTRO de e2e/ (ignorado por
  // e2e/.gitignore) — nunca se derrama a apps/web/, donde podría colarse a git.
  outputDir: './test-results',
  // fixtures.ts / helpers no son tests: el testMatch por defecto (*.spec.ts)
  // ya los excluye. auth.setup.ts se enruta a su propio proyecto `setup`.
  fullyParallel: true,
  forbidOnly: enCI,
  retries: enCI ? 2 : 1, // el sitio es remoto: un reintento absorbe el jitter de red
  workers: enCI ? 2 : undefined,
  timeout: 45_000,
  expect: {
    timeout: 15_000,
    // Regresión visual estable: sin animaciones, sin cursor, tolerancia mínima.
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.02,
      scale: 'css',
    },
  },
  reporter: enCI
    ? [['github'], ['list'], ['html', { open: 'never', outputFolder: './playwright-report' }]]
    : [['list'], ['html', { open: 'never', outputFolder: './playwright-report' }]],
  use: {
    baseURL: BASE_URL,
    navigationTimeout: 30_000,
    actionTimeout: 15_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      // Solo se ejecuta de verdad si hay credenciales; si no, se salta (skip
      // honesto). Produce el storageState que consumen los specs con sesión.
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'desktop',
      testIgnore: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile',
      testIgnore: /auth\.setup\.ts/,
      // Chromium móvil real (isMobile + touch), ancho 390 px como pide la misión.
      use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } },
    },
  ],
});
