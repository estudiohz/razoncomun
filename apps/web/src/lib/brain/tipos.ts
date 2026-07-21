/**
 * Tipos de la wiki de conocimiento del RC-Brain.
 *
 * Espejo exacto de `brain_categories` / `brain_entries`
 * (migración 0024_brain_wiki.sql, propiedad de rc-02). El área temática
 * reutiliza `public.categories` (los departamentos del blog, 0010) — mismo
 * catálogo, ninguna tabla nueva para eso.
 */

export type VisibilidadEntrada = 'internal' | 'public';
export type OrigenEntrada = 'manual' | 'proposal';

/** Tipo de visualización adjunta a una entrada del cerebro (0026_brain_entries_charts). */
export type TipoGrafico = 'bar' | 'table';

export interface FilaGrafico {
  /** Etiqueta de la barra/fila (p. ej. un tramo de ingresos). */
  label: string;
  /** Valor numérico. Lo introduce el editor a mano — nunca la IA. */
  value: number;
}

/**
 * Gráfico o tabla adjunto a una entrada de la wiki. Autoría 100% humana: el
 * editor rellena los datos en /admin/cerebro y el chat los muestra al recuperar
 * la entrada. La IA jamás inventa estas cifras (datos contrastados).
 */
export interface GraficoSpec {
  type: TipoGrafico;
  title: string;
  /** Unidad opcional que se muestra junto a cada valor (p. ej. "€/mes"). */
  unit?: string;
  /** Aclaración opcional bajo el título. */
  note?: string;
  data: FilaGrafico[];
}

export interface BrainCategoria {
  id: string;
  slug: string;
  name: string;
  position: number;
  created_at: string;
}

/** Área temática = fila de `public.categories` (departamentos del blog). */
export interface AreaTematica {
  id: number;
  slug: string;
  name: string;
  color: string;
}

export interface BrainEntrada {
  id: string;
  title: string;
  body: string;
  category_id: string;
  area_id: number | null;
  visibility: VisibilidadEntrada;
  origin: OrigenEntrada;
  ref_id: string | null;
  author_id: string | null;
  indexed_at: string | null;
  /** Gráficos/tablas adjuntos (0026). Vacío si la entrada no tiene ninguno. */
  charts: GraficoSpec[];
  created_at: string;
  updated_at: string;
}
