import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  ArticuloConRelaciones,
  Categoria,
  SelloTrazabilidad,
} from './tipos';

/**
 * Capa de lectura pública del blog/observatorio.
 *
 * Dos decisiones importantes:
 *
 * 1. **Cliente sin cookies.** Se usa un cliente `supabase-js` plano con la
 *    ANON_KEY, NO el helper `@/lib/supabase/server` (que llama a `cookies()`).
 *    Leer cookies marca la ruta como dinámica y mataría el SSG/ISR. Como rol
 *    `anon`, la política `articles_select_published_or_team` de rc-02 filtra
 *    los borradores en el propio Postgres: aunque este código pidiera
 *    `status='draft'`, la base no los devolvería.
 *
 * 2. **Degradación silenciosa.** Si faltan las variables de entorno o la API
 *    no responde (p.ej. `npm run build` en CI sin secretos), las funciones
 *    devuelven listas vacías / null en lugar de reventar el build. Las páginas
 *    renderizan su estado vacío.
 */

const SELECT_ARTICULO = `
  id, slug, title, excerpt, body, category_id, cover_image, author_id,
  source_type, source_urls, status, published_at, seo_title, seo_desc, created_at,
  categoria:categories ( id, slug, name, color ),
  autor:profiles ( id, display_name )
`;

function cliente(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return createSupabaseClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Normaliza la fila de PostgREST (las relaciones llegan como objeto o array). */
function normalizar(fila: Record<string, unknown>): ArticuloConRelaciones {
  const uno = <T,>(v: unknown): T | null =>
    Array.isArray(v) ? ((v[0] as T) ?? null) : ((v as T) ?? null);
  return {
    ...(fila as unknown as ArticuloConRelaciones),
    categoria: uno<Categoria>(fila.categoria),
    autor: uno<{ id: string; display_name: string | null }>(fila.autor),
    source_urls: (fila.source_urls as string[]) ?? [],
  };
}

/** Catálogo de categorías (para los chips de filtro y el editor admin). */
export async function listarCategorias(): Promise<Categoria[]> {
  const sb = cliente();
  if (!sb) return [];
  const { data, error } = await sb
    .from('categories')
    .select('id, slug, name, color')
    .order('name');
  if (error || !data) return [];
  return data as Categoria[];
}

/**
 * Artículos publicados, más recientes primero.
 *
 * `status = 'published'` se pide explícitamente además de estar garantizado
 * por RLS: defensa en profundidad, y hace evidente la intención al leer.
 */
export async function listarArticulos({
  tipo = 'editorial',
  categoriaSlug,
  limite = 30,
  excluirSlug,
}: {
  tipo?: 'editorial' | 'observatorio';
  categoriaSlug?: string;
  limite?: number;
  excluirSlug?: string;
} = {}): Promise<ArticuloConRelaciones[]> {
  const sb = cliente();
  if (!sb) return [];

  let q = sb
    .from('articles')
    .select(SELECT_ARTICULO)
    .eq('status', 'published')
    .eq('source_type', tipo)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(limite);

  if (excluirSlug) q = q.neq('slug', excluirSlug);

  const { data, error } = await q;
  if (error || !data) return [];

  let filas = (data as Record<string, unknown>[]).map(normalizar);
  // El filtro por categoría se aplica en memoria: PostgREST no permite
  // filtrar por una columna de la tabla embebida sin un !inner join, y el
  // volumen de artículos publicados es pequeño (decenas, no miles).
  if (categoriaSlug) {
    filas = filas.filter((a) => a.categoria?.slug === categoriaSlug);
  }
  return filas;
}

/**
 * Un artículo por slug. Devuelve null si no existe **o si es borrador**:
 * RLS no lo entrega al rol `anon`, así que aquí llega vacío y la página
 * responde 404. Ese es el mecanismo que impide filtrar borradores.
 */
export async function obtenerArticulo(slug: string): Promise<ArticuloConRelaciones | null> {
  const sb = cliente();
  if (!sb) return null;
  const { data, error } = await sb
    .from('articles')
    .select(SELECT_ARTICULO)
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();
  if (error || !data) return null;
  return normalizar(data as Record<string, unknown>);
}

/** Slugs publicados — alimenta `generateStaticParams` (SSG) y el sitemap. */
export async function listarSlugsPublicados(): Promise<
  { slug: string; published_at: string | null; source_type: string }[]
> {
  const sb = cliente();
  if (!sb) return [];
  const { data, error } = await sb
    .from('articles')
    .select('slug, published_at, source_type')
    .eq('status', 'published');
  if (error || !data) return [];
  return data as { slug: string; published_at: string | null; source_type: string }[];
}

/** Relacionados: misma categoría, excluyendo el actual. Rellena con recientes. */
export async function listarRelacionados(
  articulo: ArticuloConRelaciones,
  n = 3,
): Promise<ArticuloConRelaciones[]> {
  const mismos = articulo.categoria
    ? await listarArticulos({
        tipo: articulo.source_type,
        categoriaSlug: articulo.categoria.slug,
        excluirSlug: articulo.slug,
        limite: n,
      })
    : [];
  if (mismos.length >= n) return mismos.slice(0, n);

  const recientes = await listarArticulos({
    tipo: articulo.source_type,
    excluirSlug: articulo.slug,
    limite: n + mismos.length + 2,
  });
  const vistos = new Set(mismos.map((a) => a.slug));
  for (const a of recientes) {
    if (mismos.length >= n) break;
    if (!vistos.has(a.slug)) {
      mismos.push(a);
      vistos.add(a.slug);
    }
  }
  return mismos.slice(0, n);
}

/**
 * Sello de trazabilidad — ver la nota de deuda en `tipos.ts`: `elaboradoConIa`
 * y `revisadoPor` se DERIVAN porque el esquema no tiene columnas propias.
 */
export function selloTrazabilidad(articulo: ArticuloConRelaciones): SelloTrazabilidad {
  return {
    elaboradoConIa: articulo.source_type === 'observatorio',
    revisadoPor: articulo.autor?.display_name ?? null,
    fuentes: articulo.source_urls ?? [],
  };
}

/** Fecha larga en español: "16 julio 2026". */
export function fechaLarga(iso: string | null): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Madrid',
  }).format(new Date(iso));
}

/** Fecha corta para las tarjetas: "15 jul 2026". */
export function fechaCorta(iso: string | null): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Madrid',
  })
    .format(new Date(iso))
    .replace('.', '');
}
