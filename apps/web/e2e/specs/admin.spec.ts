import { test, expect } from '@playwright/test';
import { AUTH_FILE, haySesion, MOTIVO_SIN_SESION } from '../fixtures';

/**
 * Admin — doble puerta (middleware rc-03 + guard de layout rc-09).
 *  - Sin sesión: /admin redirige a /entrar?next=/admin.
 *  - Con sesión NO admin: el guard redirige fuera del panel (a /).
 *  - Admin + 2FA (aal2): no forjable sin TOTP → test.skip declarado.
 */
test.describe('Admin @auth', () => {
  test('sin sesión, /admin redirige a /entrar', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/entrar\?next=%2Fadmin/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Entrar');
  });

  test('sin sesión, una subruta /admin/* también redirige', async ({ page }) => {
    await page.goto('/admin/usuarios');
    await expect(page).toHaveURL(/\/entrar\?next=%2Fadmin%2Fusuarios/);
  });

  test.describe('con sesión no-admin', () => {
    const authed = haySesion();
    // Solo tiene sentido si la sesión provista es de un usuario SIN rol admin.
    const esNoAdmin = authed && process.env.E2E_AUTH_ROLE !== 'admin';
    test.skip(
      !esNoAdmin,
      authed
        ? 'La sesión provista es admin (E2E_AUTH_ROLE=admin): no aplica el caso no-admin.'
        : MOTIVO_SIN_SESION,
    );
    if (esNoAdmin) test.use({ storageState: AUTH_FILE });

    test('el guard saca del panel a un usuario sin rol', async ({ page }) => {
      await page.goto('/admin');
      // requireAdminOrEditor redirige a / (o el middleware a /entrar/2fa si el
      // usuario tuviera cargo). En ningún caso debe quedarse en /admin.
      await expect(page).not.toHaveURL(/\/admin(\/|$)/);
    });
  });

  // aal2 exige un secreto TOTP y un código válido de 6 dígitos por sesión;
  // no es forjable de forma determinista desde el navegador sin el secreto MFA.
  test.skip('admin CON 2FA (aal2) accede al panel', async () => {
    // Alcanzable si se inyecta un storageState ya elevado a aal2, o si el test
    // dispone del secreto TOTP para generar el código en /entrar/2fa.
  });
});
