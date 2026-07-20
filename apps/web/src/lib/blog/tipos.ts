/**
 * Tipos del módulo Blog/Observatorio.
 *
 * Espejo exacto de las tablas `public.articles` y `public.categories`
 * (migración 0010_blog.sql, propiedad de rc-02). Aquí NO se inventan campos:
 * si algo no está en el esquema, se deriva explícitamente en `consultas.ts`.
 */

export type EstadoArticulo = 'draft' | 'published';
export type TipoFuente = 'editorial' | 'observatorio';

export interface Categoria {
  id: number;
  slug: string;
  name: string;
  /** Hex de marca guardado en BD (p.ej. "#E8792F"). */
  color: string;
}

export interface Articulo {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  category_id: number | null;
  cover_image: string | null;
  author_id: string | null;
  source_type: TipoFuente;
  source_urls: string[];
  status: EstadoArticulo;
  published_at: string | null;
  seo_title: string | null;
  seo_desc: string | null;
  created_at: string;
}

/** Artículo con su categoría y su autor ya resueltos (lo que consume la UI). */
export interface ArticuloConRelaciones extends Articulo {
  categoria: Categoria | null;
  autor: { id: string; display_name: string | null } | null;
}

/**
 * Sello de trazabilidad — marca de la casa de Razón Común.
 *
 * ⚠️ DEUDA (para rc-02): el esquema NO tiene columnas `ai_generated` ni
 * `reviewed_by`. Hasta que existan, se derivan:
 *   - `elaboradoConIa`: true si `source_type = 'observatorio'` (el feed del
 *     observatorio lo redacta la IA de rc-08 a partir de fuentes oficiales).
 *   - `revisadoPor`: `display_name` del `author_id` — en el flujo editorial
 *     el autor que publica es quien firma la revisión humana.
 * Es una aproximación honesta, no un dato explícito. Ver informe final.
 */
export interface SelloTrazabilidad {
  elaboradoConIa: boolean;
  revisadoPor: string | null;
  fuentes: string[];
}

/** Entrada del índice lateral, generada de los h2 del cuerpo markdown. */
export interface EntradaIndice {
  id: string;
  texto: string;
  nivel: 2 | 3;
}
