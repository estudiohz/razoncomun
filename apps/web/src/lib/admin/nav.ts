export type AdminNavItem = {
  href: string;
  label: string;
  disponible: boolean;
  dueño?: string;
  soloAdmin?: boolean;
};

/**
 * Navegación del panel `/admin`.
 *
 * El orden lo fijó Sergio (01/08/2026) por frecuencia de uso real, no por
 * jerarquía técnica: primero lo que se toca a diario (artículos, propuestas,
 * cerebro), al final lo que se configura una vez (ajustes, actividad,
 * usuarios, cargos). El panel personal va en su propio grupo, el último de
 * todos (ver AdminSidebar).
 *
 * Las entradas con `soloAdmin` se siguen MOSTRANDO a un editor, marcadas
 * "solo admin": la puerta real es el guard de cada página, y ocultarlas haría
 * que el editor no supiera que existen.
 */
export const adminNav: AdminNavItem[] = [
  { href: '/admin/articulos', label: 'Artículos', disponible: true, dueño: 'rc-05-blog' },
  { href: '/admin/participacion', label: 'Participación', disponible: true, dueño: 'rc-06-participacion' },
  { href: '/admin/cerebro', label: 'Cerebro IA', disponible: true },
  { href: '/admin/presupuesto', label: 'Presupuestos', disponible: true, dueño: 'rc-06-participacion' },
  { href: '/admin/paginas', label: 'Páginas', disponible: true },
  { href: '/admin/afiliados', label: 'Afiliados', disponible: true, dueño: 'rc-07-afiliacion' },
  { href: '/admin/manifiesto', label: 'Manifiesto', disponible: true, soloAdmin: true },
  { href: '/admin/ajustes', label: 'Ajustes', disponible: true, soloAdmin: true },
  { href: '/admin/actividad', label: 'Actividad', disponible: true, soloAdmin: true },
  // No estaban en la lista de Sergio; se conservan al final para no esconder
  // funcionalidad (decisión suya al preguntárselo).
  { href: '/admin', label: 'Panel de inicio', disponible: true },
  { href: '/admin/usuarios', label: 'Usuarios', disponible: true },
  { href: '/admin/organizacion', label: 'Cargos y territorio', disponible: true, soloAdmin: true },
];
