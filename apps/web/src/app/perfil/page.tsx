import { permanentRedirect } from 'next/navigation';

/**
 * `/perfil` se movió a `/panel/perfil` al unificar el panel del usuario
 * (docs/tecnico/panel-usuario.md, ola U1). Se conserva la ruta como redirect
 * permanente (308) porque está enlazada desde correos ya enviados, desde el
 * menú de usuario y desde varias páginas.
 *
 * Nota: `actions.ts` sigue viviendo en esta carpeta — lo importan el menú de
 * usuario, el menú móvil y los dos layouts de panel. No es una ruta (solo
 * page.tsx/route.ts lo son), así que convivir con este redirect es correcto.
 */
export default function PerfilRedirectPage() {
  permanentRedirect('/panel/perfil');
}
