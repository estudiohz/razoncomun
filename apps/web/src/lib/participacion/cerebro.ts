import type { SupabaseClient } from '@supabase/supabase-js';
import { editorAMarkdown } from '@/lib/blog/editorMarkdown';
import { site } from '@/lib/site';

/**
 * Paso de una propuesta APROBADA al cerebro (RC-Brain).
 *
 * El visitante lee el HTML del editor visual; la IA necesita markdown. Esa
 * versión no la escribe nadie: se genera aquí al aprobar y se guarda como una
 * entrada de la wiki (`brain_entries`, origin='proposal', ref_id = propuesta),
 * que el job de ingesta indexa (`indexed_at` null = pendiente).
 *
 * Solo se sincroniza al APROBAR: editar después una propuesta ya aprobada no
 * toca el cerebro hasta que se vuelva a aprobar, para que lo que sabe la IA sea
 * siempre lo que los socios votaron y no un borrador posterior.
 *
 * `sesion` debe poder escribir en brain_entries (RLS: is_editor): se le pasa el
 * cliente admin, porque quien aprueba es coordinador y no siempre editor. La
 * autorización ya la ha dado el trigger `proposals_protect_status`.
 */

interface FilaPropuesta {
  id: string;
  title: string;
  slug: string | null;
  body: string;
  body_format: 'markdown' | 'html' | null;
  department: string;
  adopted_at: string | null;
}

/**
 * Cuerpo de la propuesta → markdown.
 *
 * No se fía de `body_format`: en `proposals` la columna nació con el valor por
 * defecto 'markdown' y el contenido siempre fue HTML (textoPlanoAHtml), así que
 * la etiqueta mentía. Lo que manda es lo que el cuerpo ES.
 */
export function cuerpoAMarkdown(body: string, _formato: 'markdown' | 'html' | null): string {
  return /^\s*<(p|h[1-6]|ul|ol|table|div|figure|blockquote|img)[\s>]/i.test(body)
    ? editorAMarkdown(body)
    : body.trim();
}

/** Markdown de la entrada del cerebro: cabecera de procedencia + cuerpo. */
export function markdownParaCerebro(p: FilaPropuesta): string {
  const fecha = new Date(p.adopted_at ?? Date.now()).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const url = `${site.urlBase}/propuestas/${p.slug ?? p.id}`;
  return [
    `> Propuesta aprobada por los socios de Razón Común el ${fecha}. Fuente: ${url}`,
    '',
    cuerpoAMarkdown(p.body, p.body_format),
  ].join('\n');
}

/** Crea o actualiza la entrada del cerebro de una propuesta aprobada. */
export async function publicarPropuestaEnCerebro(
  admin: SupabaseClient,
  propuestaId: string,
  /** null en cargas masivas sin un usuario concreto (author_id admite null). */
  actorId: string | null,
): Promise<void> {
  const { data: p, error } = await admin
    .from('proposals')
    .select('id, title, slug, body, body_format, department, adopted_at')
    .eq('id', propuestaId)
    .single();
  if (error || !p) throw new Error(`Propuesta no encontrada: ${error?.message ?? propuestaId}`);

  const [{ data: cat }, { data: area }, { data: previa }] = await Promise.all([
    admin.from('brain_categories').select('id').eq('slug', 'programa').single(),
    admin.from('categories').select('id').eq('slug', (p as FilaPropuesta).department).maybeSingle(),
    admin.from('brain_entries').select('id').eq('origin', 'proposal').eq('ref_id', propuestaId).maybeSingle(),
  ]);
  if (!cat) throw new Error("Falta la categoría 'programa' del cerebro.");

  const fila = {
    title: (p as FilaPropuesta).title,
    body: markdownParaCerebro(p as FilaPropuesta),
    body_format: 'markdown',
    category_id: cat.id,
    area_id: area?.id ?? null,
    visibility: 'public',
    origin: 'proposal',
    ref_id: propuestaId,
  };

  const { error: errEscritura } = previa
    ? await admin.from('brain_entries').update(fila).eq('id', previa.id)
    : await admin.from('brain_entries').insert({ ...fila, author_id: actorId });
  if (errEscritura) throw new Error(errEscritura.message);
}
