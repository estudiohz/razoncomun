export type AdminNavItem = {
  href: string;
  label: string;
  disponible: boolean;
  dueño?: string;
  soloAdmin?: boolean;
};

/**
 * Navegación del panel. Las entradas con `disponible: false` son huecos
 * dejados para las secciones que construyen otros agentes de la Ola 3
 * (rc-05 blog, rc-06 participación, rc-07 afiliación) — llevan una página
 * placeholder para que el enlace no rompa, y se espera que su propio
 * agente sobrescriba esa ruta al mergear su rama (conflicto anticipado en
 * plan-lanzamiento.md: "suelen ser navegación del admin").
 */
export const adminNav: AdminNavItem[] = [
  { href: '/admin', label: 'Panel de inicio', disponible: true },
  { href: '/admin/usuarios', label: 'Usuarios', disponible: true },
  { href: '/admin/organizacion', label: 'Cargos y territorio', disponible: true, soloAdmin: true },
  { href: '/admin/manifiesto', label: 'Manifiesto', disponible: true, soloAdmin: true },
  { href: '/admin/cerebro', label: 'Cerebro', disponible: true },
  { href: '/admin/ajustes', label: 'Ajustes', disponible: true, soloAdmin: true },
  { href: '/admin/articulos', label: 'Artículos', disponible: true, dueño: 'rc-05-blog' },
  { href: '/admin/participacion', label: 'Participación', disponible: true, dueño: 'rc-06-participacion' },
  { href: '/admin/afiliados', label: 'Afiliados', disponible: true, dueño: 'rc-07-afiliacion' },
  { href: '/admin/actividad', label: 'Actividad', disponible: true, soloAdmin: true },
];
