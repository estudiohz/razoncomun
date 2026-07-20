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
  created_at: string;
  updated_at: string;
}
