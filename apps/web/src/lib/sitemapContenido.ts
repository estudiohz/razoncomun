import { createClient } from '@supabase/supabase-js';
import { anonKeySupabase, urlSupabase } from '@/lib/supabase/env';

/**
 * Contenido dinámico para el sitemap: páginas del CMS y puntos del manifiesto.
 *
 * El CEREBRO queda fuera a propósito (Sergio, 29/08/2026): no necesita ser
 * indexable. Sus entradas existen para alimentar el RAG y para consulta
 * interna, no para captar tráfico de búsqueda.
 *
 * Los artículos y sus categorías ya los aportaba `lib/blog/consultas`; esto
 * completa lo que faltaba.
 *
 * SE CONSULTA COMO `anon` A PROPÓSITO. No se filtra "a mano" lo que es público:
 * se deja que decidan las políticas RLS, las mismas que sirven la web. Así es
 * imposible colar en el sitemap un borrador o una entrada interna aunque
 * alguien se olvide de un `where` — y si mañana cambia la definición de
 * "público", el sitemap la sigue sin tocar este fichero.
 */

type Fila = { loc: string; lastmod: string | null };

function cliente() {
  try {
    return createClient(urlSupabase(), anonKeySupabase(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  } catch {
    return null;
  }
}

/** Páginas del CMS publicadas → `/{slug}`. */
export async function paginasParaSitemap(): Promise<Fila[]> {
  const sb = cliente();
  if (!sb) return [];
  const { data, error } = await sb.from('pages').select('slug, updated_at').eq('published', true);
  if (error || !data) return [];
  return (data as { slug: string; updated_at: string | null }[]).map((p) => ({
    loc: `/${p.slug}`,
    lastmod: p.updated_at,
  }));
}

/** Puntos del manifiesto → `/transparencia/manifiesto/{id}`. */
export async function manifiestoParaSitemap(): Promise<Fila[]> {
  const sb = cliente();
  if (!sb) return [];
  const { data, error } = await sb.from('manifesto_points').select('id, updated_at');
  if (error || !data) return [];
  return (data as { id: string | number; updated_at: string | null }[]).map((p) => ({
    loc: `/transparencia/manifiesto/${p.id}`,
    lastmod: p.updated_at,
  }));
}
