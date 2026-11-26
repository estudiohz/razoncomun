import type { ComponentType } from 'react';
import type { Pagina } from '@/lib/paginas';
import { PlantillaComparador29N } from './comparador29n/PlantillaComparador29N';

/** Props que recibe toda plantilla: la fila de la página y su HTML ya saneado. */
export interface PropsPlantilla {
  pagina: Pagina;
  introHtml: string;
}

const REGISTRO: Record<string, ComponentType<PropsPlantilla>> = {
  'comparador-29n': PlantillaComparador29N,
};

/** null = plantilla estándar (o clave desconocida): la ruta pinta el diseño de siempre. */
export function componentePlantilla(clave: string | null | undefined): ComponentType<PropsPlantilla> | null {
  return (clave && REGISTRO[clave]) || null;
}
