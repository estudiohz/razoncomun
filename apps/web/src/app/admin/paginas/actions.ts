'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireEditor } from '@/lib/blog/guard';
import { slugificar, sanitizarHtml } from '@/lib/paginas';

export interface ResultadoPagina {
  ok: boolean;
  error?: string;
}

function texto(fd: FormData, campo: string): string {
  return String(fd.get(campo) ?? '').trim();
}
function flag(fd: FormData, campo: string): boolean {
  return fd.get(campo) === 'on';
}

/**
 * Crea o actualiza una página del CMS. El cuerpo (HTML del editor WYSIWYG) se
 * sanea antes de guardar. Al cambiar algo se revalida la propia página y el
 * layout raíz (footer/menús se recalculan con las páginas publicadas).
 */
export async function guardarPagina(
  _previo: ResultadoPagina | null,
  fd: FormData,
): Promise<ResultadoPagina> {
  const { supabase, userId } = await requireEditor();

  const id = texto(fd, 'id');
  const title = texto(fd, 'title');
  const slug = slugificar(texto(fd, 'slug') || title);
  const body_html = sanitizarHtml(texto(fd, 'body_html'));

  if (!title) return { ok: false, error: 'El título es obligatorio.' };
  if (!slug) return { ok: false, error: 'No se ha podido generar un slug válido.' };

  const fila = {
    slug,
    title,
    body_html,
    show_header: flag(fd, 'show_header'),
    show_footer: flag(fd, 'show_footer'),
    show_legal: flag(fd, 'show_legal'),
    position: Number(texto(fd, 'position')) || 0,
    published: flag(fd, 'published'),
  };

  const errDup = (msg: string) =>
    msg.includes('duplicate') || msg.toLowerCase().includes('unique')
      ? `Ya existe una página con el slug "${slug}". Usa otro.`
      : null;

  if (id) {
    const { error } = await supabase.from('pages').update(fila).eq('id', id);
    if (error) return { ok: false, error: errDup(error.message) ?? `No se ha podido guardar: ${error.message}` };
    revalidatePath('/admin/paginas');
    revalidatePath(`/admin/paginas/${id}`);
    revalidatePath(`/${slug}`);
    revalidatePath('/', 'layout');
    return { ok: true };
  }

  const { data, error } = await supabase
    .from('pages')
    .insert({ ...fila, author_id: userId })
    .select('id')
    .single();
  if (error) return { ok: false, error: errDup(error.message) ?? `No se ha podido crear: ${error.message}` };

  revalidatePath('/admin/paginas');
  revalidatePath('/', 'layout');
  redirect(`/admin/paginas/${data.id}`);
}

/** Elimina una o varias páginas. RLS ya exige is_editor; requireEditor es la 2ª capa. */
export async function eliminarPaginas(ids: string[]): Promise<ResultadoPagina> {
  const { supabase } = await requireEditor();
  const limpios = Array.from(new Set((ids ?? []).map((s) => String(s).trim()).filter(Boolean)));
  if (limpios.length === 0) return { ok: false, error: 'No hay páginas seleccionadas.' };

  const { error } = await supabase.from('pages').delete().in('id', limpios);
  if (error) return { ok: false, error: `No se han podido eliminar: ${error.message}` };

  revalidatePath('/admin/paginas');
  revalidatePath('/', 'layout');
  return { ok: true };
}
