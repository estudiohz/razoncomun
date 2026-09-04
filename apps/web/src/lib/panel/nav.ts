import type { GrupoNavPanel } from '@/components/panel/PanelNav';

/**
 * Navegación del panel del usuario (`/panel`) — docs/tecnico/panel-usuario.md.
 *
 * Las cuatro secciones base las ve CUALQUIER usuario logueado, sea cual sea su
 * nivel: lo que cambia dentro de cada una es el contenido, no el acceso. Es
 * deliberado (D-U3):
 *
 * - Cuota la ve un `registered` porque es justo donde se da de alta; un
 *   `member` ve la gestión de su cuota. Ocultarla al no socio sería
 *   esconderle la puerta de entrada.
 * - Propuestas la ve todo el mundo porque cualquier registrado puede crear y
 *   seguir hilos; votar es lo que exige nivel, y eso se resuelve dentro.
 *
 * El grupo "Administración" solo se añade (en el layout) si el usuario es
 * editor o admin, y enlaza al panel `/admin`, que sigue siendo una zona
 * aparte con su propio guard.
 */
export const gruposPanelUsuario: GrupoNavPanel[] = [
  {
    items: [
      { href: '/panel', label: 'Inicio', exacto: true },
      { href: '/panel/perfil', label: 'Mi perfil' },
      { href: '/panel/propuestas', label: 'Mis propuestas' },
      { href: '/panel/afiliacion', label: 'Cuota' },
      { href: '/panel/carnet', label: 'Mi carnet' },
    ],
  },
];

/** Grupo extra que se cuelga del panel de usuario cuando además es editor/admin. */
export function grupoAdministracion(reportesAbiertos: number, borradoresBot: number): GrupoNavPanel {
  return {
    titulo: 'Administración',
    items: [
      { href: '/admin', label: 'Panel de administración', exacto: true },
      { href: '/admin/participacion', label: 'Moderar propuestas', badge: reportesAbiertos + borradoresBot },
    ],
  };
}
