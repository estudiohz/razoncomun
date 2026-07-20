/**
 * Datos mock TIPADOS para la home. Los módulos reales los conectan otros
 * agentes (rc-05 blog/observatorio, rc-02 datos). Aquí solo se replica el
 * contenido del boceto con tipos estables para que el swap sea trivial.
 */

export type Categoria =
  | 'vivienda'
  | 'economia'
  | 'sanidad'
  | 'justicia'
  | 'agricultura'
  | 'autonomos'
  | 'transparencia'
  | 'educacion';

export interface ArticuloFeed {
  slug: string;
  fecha: string; // legible, p.ej. "16 JUL 2026"
  categoria: Categoria;
  titulo: string;
  extracto: string;
  imagen: string;
  alt: string;
}

/** Feed "Lo último del Observatorio" — 3 tarjetas del boceto. */
export const feedObservatorio: ArticuloFeed[] = [
  {
    slug: 'paro-juvenil-25-9-dato-ine',
    fecha: '16 JUL 2026',
    categoria: 'economia',
    titulo: 'El paro juvenil baja al 25,9%: qué hay detrás del dato del INE',
    extracto:
      'La serie completa comparada con la media europea. La brecha con la UE sigue en 11 puntos.',
    imagen: '/fotos/jovenes-diversos.jpg',
    alt: 'Jóvenes caminando juntos por la ciudad',
  },
  {
    slug: 'licencias-obra-espana-nueve-meses-mas',
    fecha: '15 JUL 2026',
    categoria: 'vivienda',
    titulo: 'Licencias de obra: España tarda 9 meses más que Alemania',
    extracto:
      'Datos de Eurostat sobre plazos administrativos y su efecto directo en el precio final.',
    imagen: '/fotos/pareja-vivienda.jpg',
    alt: 'Pareja joven mudándose a su vivienda',
  },
  {
    slug: 'boe-semana-nadie-te-conto',
    fecha: '14 JUL 2026',
    categoria: 'transparencia',
    titulo: 'Lo que el BOE publicó esta semana y nadie te contó',
    extracto:
      'Resumen verificado de las disposiciones con impacto real en tu bolsillo.',
    imagen: '/fotos/justicia2.jpg',
    alt: 'Documentación oficial y justicia',
  },
];

/** Etiqueta legible de cada categoría (para las etiquetas de color). */
export const etiquetaCategoria: Record<Categoria, string> = {
  vivienda: 'Vivienda',
  economia: 'Economía',
  sanidad: 'Sanidad',
  justicia: 'Justicia',
  agricultura: 'Agricultura',
  autonomos: 'Autónomos',
  transparencia: 'Transparencia',
  educacion: 'Educación',
};
