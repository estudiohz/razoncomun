import { adminNav } from '@/lib/admin/nav';
import {
  PanelSidebar,
  PanelMobileMenu,
  type GrupoNavPanel,
} from '@/components/panel/PanelNav';

/**
 * Navegación del panel `/admin`.
 *
 * Desde la ola U1 (docs/tecnico/panel-usuario.md, D-U1) esto ya no implementa
 * su propio sidebar: el shell (sidebar de escritorio + drawer móvil, marcado y
 * estilos) vive en components/panel/PanelNav y lo comparte con `/panel`, el
 * panel del usuario normal. Aquí solo queda traducir `adminNav` + los roles a
 * la forma genérica de items. Así el usuario ve la MISMA interfaz de gestión
 * en ambos sitios y no hay dos maquetaciones que mantener en paralelo.
 *
 * Estos dos componentes ya no necesitan ser client: el estado del drawer vive
 * dentro de PanelMobileMenu.
 */
function gruposDeAdmin(esAdmin: boolean, badges?: Record<string, number>): GrupoNavPanel[] {
  return [
    {
      items: adminNav.map((item) => ({
        href: item.href,
        label: item.label,
        exacto: item.href === '/admin',
        badge: badges?.[item.href],
        // Se sigue mostrando la entrada bloqueada (no se oculta) para que el
        // editor sepa que existe y por qué no la tiene: la puerta real es el
        // guard de cada página, no este menú.
        nota: item.soloAdmin && !esAdmin ? 'solo admin' : undefined,
      })),
    },
    {
      titulo: 'Mi cuenta',
      items: [
        { href: '/panel', label: 'Mi panel', exacto: true },
        { href: '/panel/perfil', label: 'Mi perfil' },
      ],
    },
  ];
}

export function AdminSidebar({
  esAdmin,
  badges,
}: {
  esAdmin: boolean;
  esEditor: boolean;
  badges?: Record<string, number>;
}) {
  return (
    <PanelSidebar
      grupos={gruposDeAdmin(esAdmin, badges)}
      homeHref="/admin"
      etiqueta="Administración"
    />
  );
}

export function AdminMobileMenu({
  esAdmin,
  badges,
}: {
  esAdmin: boolean;
  esEditor: boolean;
  badges?: Record<string, number>;
}) {
  return <PanelMobileMenu grupos={gruposDeAdmin(esAdmin, badges)} etiqueta="Administración" />;
}
