'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { slugificar } from '@/lib/blog/markdown';
import { requireEditorCerebro } from './guard';

// `requireEditorCerebro` vive en `./guard` porque este módulo es `'use server'`:
// solo puede exportar funciones async serializables, y aquella devuelve un
// cliente de Supabase, que no lo es.

export interface ResultadoAccion {
  ok: boolean;
  error?: string;
}

function texto(fd: FormData, campo: string): string {
  return String(fd.get(campo) ?? '').trim();
}

/**
 * Crea o actualiza una entrada de la wiki.
 *
 * `category_id` es obligatorio (la BD lo exige con `not null`); `area_id` es
 * opcional (no todo documento de conocimiento tiene departamento — p.ej.
 * Estatutos). El trigger `brain_entries_reset_indexed_at_trg` (0024) ya pone
 * `indexed_at = NULL` en el UPDATE si cambia `body` o `visibility`: aquí no
 * hace falta tocar esa columna a mano.
 *
 * Al CREAR se redirige a la ficha ya con id real — evita el problema clásico
 * de reenviar el mismo formulario de alta y duplicar la entrada (el id
 * seguiría vacío en el DOM hasta una navegación real).
 */
export async function guardarEntrada(
  _previo: ResultadoAccion | null,
  fd: FormData,
): Promise<ResultadoAccion> {
  const { supabase, userId } = await requireEditorCerebro();

  const id = texto(fd, 'id');
  const title = texto(fd, 'title');
  const body = texto(fd, 'body');
  const categoryId = texto(fd, 'category_id');
  const areaIdTexto = texto(fd, 'area_id');
  const visibility = texto(fd, 'visibility') === 'public' ? 'public' : 'internal';

  if (!title) return { ok: false, error: 'El título es obligatorio.' };
  if (!body) return { ok: false, error: 'El cuerpo es obligatorio.' };
  if (!categoryId) return { ok: false, error: 'La categoría es obligatoria.' };

  const fila = {
    title,
    body,
    category_id: categoryId,
    area_id: areaIdTexto ? Number(areaIdTexto) : null,
    visibility,
  };

  if (id) {
    const { error } = await supabase.from('brain_entries').update(fila).eq('id', id);
    if (error) return { ok: false, error: `No se ha podido guardar: ${error.message}` };
    revalidatePath('/admin/cerebro');
    revalidatePath(`/admin/cerebro/${id}`);
    return { ok: true };
  }

  const { data, error } = await supabase
    .from('brain_entries')
    .insert({ ...fila, author_id: userId })
    .select('id')
    .single();
  if (error) return { ok: false, error: `No se ha podido crear: ${error.message}` };

  revalidatePath('/admin/cerebro');
  redirect(`/admin/cerebro/${data.id}`);
}

/**
 * Elimina una o varias entradas (borrado en masa desde el listado).
 * RLS (`brain_entries_write_editor`, `for all`) ya exige `is_editor()`;
 * `requireEditorCerebro` es la segunda capa.
 */
export async function eliminarEntradas(ids: string[]): Promise<ResultadoAccion> {
  const { supabase } = await requireEditorCerebro();

  const limpios = Array.from(new Set((ids ?? []).map((s) => String(s).trim()).filter(Boolean)));
  if (limpios.length === 0) return { ok: false, error: 'No hay entradas seleccionadas.' };

  const { error } = await supabase.from('brain_entries').delete().in('id', limpios);
  if (error) return { ok: false, error: `No se han podido eliminar: ${error.message}` };

  revalidatePath('/admin/cerebro');
  return { ok: true };
}

/** Crea una categoría de la wiki. Slug autogenerado del nombre (ascii sin acentos). */
export async function crearCategoria(
  _previo: ResultadoAccion | null,
  fd: FormData,
): Promise<ResultadoAccion> {
  const { supabase } = await requireEditorCerebro('/admin/cerebro/categorias');

  const name = texto(fd, 'name');
  if (!name) return { ok: false, error: 'El nombre es obligatorio.' };

  const slug = slugificar(name);
  if (!slug) return { ok: false, error: 'No se ha podido generar un slug válido a partir del nombre.' };

  const { data: ultima } = await supabase
    .from('brain_categories')
    .select('position')
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (ultima?.position ?? -1) + 1;

  const { error } = await supabase.from('brain_categories').insert({ slug, name, position });
  if (error) {
    return {
      ok: false,
      error:
        error.code === '23505'
          ? `Ya existe una categoría con el slug "${slug}". Prueba con otro nombre.`
          : `No se ha podido crear: ${error.message}`,
    };
  }

  revalidatePath('/admin/cerebro/categorias');
  revalidatePath('/admin/cerebro');
  return { ok: true };
}

/** Renombra una categoría. El slug NO cambia: evita romper referencias externas (p.ej. el futuro connector de ingesta de rc-08). */
export async function renombrarCategoria(id: string, name: string): Promise<ResultadoAccion> {
  const { supabase } = await requireEditorCerebro('/admin/cerebro/categorias');

  const limpio = name.trim();
  if (!id) return { ok: false, error: 'Categoría inválida.' };
  if (!limpio) return { ok: false, error: 'El nombre es obligatorio.' };

  const { error } = await supabase.from('brain_categories').update({ name: limpio }).eq('id', id);
  if (error) return { ok: false, error: `No se ha podido renombrar: ${error.message}` };

  revalidatePath('/admin/cerebro/categorias');
  revalidatePath('/admin/cerebro');
  return { ok: true };
}

/** Sube o baja una categoría una posición, intercambiando `position` con la vecina. */
export async function reordenarCategoria(
  id: string,
  direccion: 'subir' | 'bajar',
): Promise<ResultadoAccion> {
  const { supabase } = await requireEditorCerebro('/admin/cerebro/categorias');

  const { data: categorias, error } = await supabase
    .from('brain_categories')
    .select('id, position')
    .order('position', { ascending: true });
  if (error) return { ok: false, error: `No se ha podido leer el orden: ${error.message}` };

  const lista = categorias ?? [];
  const idx = lista.findIndex((c) => c.id === id);
  if (idx < 0) return { ok: false, error: 'Categoría no encontrada.' };

  const vecinoIdx = direccion === 'subir' ? idx - 1 : idx + 1;
  if (vecinoIdx < 0 || vecinoIdx >= lista.length) return { ok: true }; // ya está en el extremo: no-op silencioso

  const actual = lista[idx];
  const vecino = lista[vecinoIdx];

  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    supabase.from('brain_categories').update({ position: vecino.position }).eq('id', actual.id),
    supabase.from('brain_categories').update({ position: actual.position }).eq('id', vecino.id),
  ]);
  if (e1 || e2) return { ok: false, error: `No se ha podido reordenar: ${(e1 ?? e2)!.message}` };

  revalidatePath('/admin/cerebro/categorias');
  revalidatePath('/admin/cerebro');
  return { ok: true };
}

/**
 * Elimina una categoría — solo si no tiene entradas (la FK `category_id` es
 * `on delete restrict`, la BD lo bloquearía igualmente; aquí se comprueba
 * antes para dar un mensaje claro en vez de un error de Postgres crudo).
 */
export async function eliminarCategoria(id: string): Promise<ResultadoAccion> {
  const { supabase } = await requireEditorCerebro('/admin/cerebro/categorias');
  if (!id) return { ok: false, error: 'Categoría inválida.' };

  const { count, error: errorConteo } = await supabase
    .from('brain_entries')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', id);
  if (errorConteo) return { ok: false, error: `No se ha podido comprobar: ${errorConteo.message}` };
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `No se puede eliminar: tiene ${count} entrada${count === 1 ? '' : 's'}. Muévelas a otra categoría o bórralas primero.`,
    };
  }

  const { error } = await supabase.from('brain_categories').delete().eq('id', id);
  if (error) return { ok: false, error: `No se ha podido eliminar: ${error.message}` };

  revalidatePath('/admin/cerebro/categorias');
  revalidatePath('/admin/cerebro');
  return { ok: true };
}
