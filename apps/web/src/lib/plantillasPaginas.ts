/**
 * Catálogo de plantillas de diseño para las páginas del CMS (0083).
 * Solo metadatos (sirve en cliente y servidor). El componente de cada clave
 * vive en components/paginas/plantillas/index.tsx. Para añadir una plantilla:
 * 1) crea su componente, 2) regístralo allí, 3) añade aquí su entrada.
 */
export interface PlantillaPagina {
  clave: string;
  nombre: string;
  descripcion: string;
}

export const PLANTILLAS_PAGINA: PlantillaPagina[] = [
  { clave: 'estandar', nombre: 'Estándar', descripcion: 'Título y contenido del editor.' },
  {
    clave: 'comparador-29n',
    nombre: 'Comparador 29N',
    descripcion: 'Comparador interactivo de programas de las generales del 29N. El contenido del editor sale como introducción.',
  },
];

export function plantillaValida(clave: string | null | undefined): string {
  return PLANTILLAS_PAGINA.some((p) => p.clave === clave) ? (clave as string) : 'estandar';
}
