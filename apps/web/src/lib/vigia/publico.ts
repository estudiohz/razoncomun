import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Lectura pública de la auditoría (F2). Siempre con el cliente del visitante:
 * la RLS de la 0069 solo devuelve casos `published` con `published_at <= now()`
 * y la prueba principal de esos casos. Nada interno sale por aquí.
 */

/**
 * La sección está construida pero NO enlazada ni indexada hasta el visto
 * bueno legal (T2.5: revisión del abogado de las primeras fichas). Cuando se
 * dé, basta con poner AUDITORIA_PUBLICA=true en el entorno.
 */
export function auditoriaAbierta(): boolean {
  return process.env.AUDITORIA_PUBLICA === 'true';
}

export interface CasoPublico {
  id: string;
  slug: string;
  title: string;
  organismo: string | null;
  organismo_nivel: string | null;
  adjudicatario: string | null;
  adjudicatario_nif: string | null;
  es_persona_fisica: boolean;
  categoria: string | null;
  importe_oficial_cents: number | null;
  importe_denunciado_cents: number | null;
  fecha_adjudicacion: string | null;
  verificacion: string | null;
  hechos_html: string | null;
  valoracion_html: string | null;
  replica_solicitada_at: string | null;
  replica_texto: string | null;
  reel_url: string | null;
  reel_autor: string | null;
  reel_autor_url: string | null;
  verified_at: string | null;
  published_at: string;
  rectificado_at: string | null;
  rectificacion_nota: string | null;
  ai_model: string | null;
  counts_in_total: boolean;
  cover_image: string | null;
  reel_frame: string | null;
  category_id: number | null;
  categoria_blog: { slug: string; name: string; color: string } | null;
}

const COLUMNAS =
  'id, slug, title, organismo, organismo_nivel, adjudicatario, adjudicatario_nif, es_persona_fisica, categoria, importe_oficial_cents, importe_denunciado_cents, fecha_adjudicacion, verificacion, hechos_html, valoracion_html, replica_solicitada_at, replica_texto, reel_url, reel_autor, reel_autor_url, verified_at, published_at, rectificado_at, rectificacion_nota, ai_model, counts_in_total, cover_image, reel_frame, category_id, categoria_blog:categories(slug, name, color)';

export async function listarCasosPublicos(supabase: SupabaseClient): Promise<CasoPublico[]> {
  const { data } = await supabase
    .from('watchdog_alerts')
    .select(COLUMNAS)
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false })
    .limit(200);
  return (data ?? []) as unknown as CasoPublico[];
}

export async function casoPublico(supabase: SupabaseClient, slug: string): Promise<CasoPublico | null> {
  const { data } = await supabase
    .from('watchdog_alerts')
    .select(COLUMNAS)
    .eq('slug', slug)
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
    .maybeSingle();
  if (!data) return null;
  const c = data as unknown as CasoPublico;
  // Minimización (doc 03): de una persona física no se publica el NIF.
  return c.es_persona_fisica ? { ...c, adjudicatario_nif: null } : c;
}

export async function totales(supabase: SupabaseClient): Promise<{ casos: number; importe_cents: number; actualizado: string | null }> {
  const { data } = await supabase.rpc('watchdog_totals');
  const fila = Array.isArray(data) ? data[0] : data;
  return {
    casos: Number(fila?.casos ?? 0),
    importe_cents: Number(fila?.importe_cents ?? 0),
    actualizado: fila?.actualizado ?? null,
  };
}

export const euros = (c: number | null | undefined) =>
  c == null ? '—' : (c / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });

/** Euros sin céntimos, para cifras de portada. */
export const eurosEnteros = (c: number | null | undefined) =>
  c == null ? '—' : (c / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export const NOMBRE_CATEGORIA: Record<string, string> = {
  consultoria: 'Consultoría',
  eventos: 'Eventos',
  publicidad: 'Publicidad',
  obras: 'Obras',
  suministros: 'Suministros',
  subvencion: 'Subvención',
  otro: 'Otro',
};

/** Disposiciones del BOE indexadas por el job diario (0076) y fecha de la más antigua. */
export async function boeIndexado(supabase: SupabaseClient): Promise<{ total: number; desde: string | null }> {
  const [{ count }, { data }] = await Promise.all([
    supabase.from('boe_items').select('id', { count: 'exact', head: true }),
    supabase.from('boe_items').select('published_date').order('published_date', { ascending: true }).limit(1),
  ]);
  return { total: count ?? 0, desde: (data?.[0]?.published_date as string | undefined) ?? null };
}

export const fechaLarga = (f: string | null | undefined) =>
  f ? new Date(f.length === 10 ? `${f}T12:00:00Z` : f).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' }) : '—';

export const NOMBRE_VERIFICACION: Record<string, string> = {
  coincide: 'Coincide con la fuente oficial',
  parcial: 'Coincide en parte con la fuente oficial',
  no_encontrado: 'No consta en fuentes oficiales',
  desmentido: 'La fuente oficial lo desmiente',
};
