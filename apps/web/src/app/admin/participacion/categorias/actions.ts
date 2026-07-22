'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminOrEditor } from '@/lib/admin/guard';

export interface ResultadoAccion {
  ok: boolean;
  error?: string;
}

const HEX_RE = /^#[0-9a-f]{6}$/i;

function texto(fd: FormData, campo: string): string {
  return String(fd.get(campo) ?? '').trim();
}

/** Crea una categoría del tablero de propuestas (D-P2). RLS exige `is_editor()`. */
export async function crearCategoriaPropuesta(
  _previo: ResultadoAccion | null,
  fd: FormData,
): Promise<ResultadoAccion> {
  const { supabase } = await requireAdminOrEditor('/admin/participacion/categorias');

  const nombre = texto(fd, 'nombre');
  const color = texto(fd, 'color');
  if (!nombre) return { ok: false, error: 'El nombre es obligatorio.' };
  if (!HEX_RE.test(color)) return { ok: false, error: 'El color debe ser un hex válido, p. ej. #8B30D9.' };

  const { data: ultima } = await supabase
    .from('proposal_categories')
    .select('orden')
    .order('orden', { ascending: false })
    .limit(1)
    .maybeSingle();
  const orden = (ultima?.orden ?? -1) + 1;

  const { error } = await supabase.from('proposal_categories').insert({ nombre, color, orden });
  if (error) {
    return {
      ok: false,
      error:
        error.code === '23505'
          ? `Ya existe una categoría llamada "${nombre}".`
          : `No se ha podido crear: ${error.message}`,
    };
  }

  revalidatePath('/admin/participacion/categorias');
  return { ok: true };
}

/** Renombra y/o recolorea una categoría existente. */
export async function editarCategoriaPropuesta(
  id: string,
  nombre: string,
  color: string,
): Promise<ResultadoAccion> {
  const { supabase } = await requireAdminOrEditor('/admin/participacion/categorias');

  const nombreLimpio = nombre.trim();
  if (!id) return { ok: false, error: 'Categoría inválida.' };
  if (!nombreLimpio) return { ok: false, error: 'El nombre es obligatorio.' };
  if (!HEX_RE.test(color)) return { ok: false, error: 'El color debe ser un hex válido, p. ej. #8B30D9.' };

  const { error } = await supabase
    .from('proposal_categories')
    .update({ nombre: nombreLimpio, color })
    .eq('id', id);
  if (error) {
    return {
      ok: false,
      error:
        error.code === '23505'
          ? `Ya existe una categoría llamada "${nombreLimpio}".`
          : `No se ha podido guardar: ${error.message}`,
    };
  }

  revalidatePath('/admin/participacion/categorias');
  return { ok: true };
}

/** Sube o baja una categoría una posición, intercambiando `orden` con la vecina. */
export async function reordenarCategoriaPropuesta(
  id: string,
  direccion: 'subir' | 'bajar',
): Promise<ResultadoAccion> {
  const { supabase } = await requireAdminOrEditor('/admin/participacion/categorias');

  const { data: categorias, error } = await supabase
    .from('proposal_categories')
    .select('id, orden')
    .order('orden', { ascending: true });
  if (error) return { ok: false, error: `No se ha podido leer el orden: ${error.message}` };

  const lista = categorias ?? [];
  const idx = lista.findIndex((c) => c.id === id);
  if (idx < 0) return { ok: false, error: 'Categoría no encontrada.' };

  const vecinoIdx = direccion === 'subir' ? idx - 1 : idx + 1;
  if (vecinoIdx < 0 || vecinoIdx >= lista.length) return { ok: true };

  const actual = lista[idx];
  const vecino = lista[vecinoIdx];

  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    supabase.from('proposal_categories').update({ orden: vecino.orden }).eq('id', actual.id),
    supabase.from('proposal_categories').update({ orden: actual.orden }).eq('id', vecino.id),
  ]);
  if (e1 || e2) return { ok: false, error: `No se ha podido reordenar: ${(e1 ?? e2)!.message}` };

  revalidatePath('/admin/participacion/categorias');
  return { ok: true };
}

/** Elimina una categoría — solo si ninguna propuesta la usa (category_id es nullable, no hay ON DELETE RESTRICT explícito pero se comprueba igualmente para no dejar hilos huérfanos sin avisar). */
export async function eliminarCategoriaPropuesta(id: string): Promise<ResultadoAccion> {
  const { supabase } = await requireAdminOrEditor('/admin/participacion/categorias');
  if (!id) return { ok: false, error: 'Categoría inválida.' };

  const { count, error: errorConteo } = await supabase
    .from('proposals')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', id);
  if (errorConteo) return { ok: false, error: `No se ha podido comprobar: ${errorConteo.message}` };
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `No se puede eliminar: ${count} propuesta${count === 1 ? '' : 's'} usan esta categoría. Cámbialas de categoría primero.`,
    };
  }

  const { error } = await supabase.from('proposal_categories').delete().eq('id', id);
  if (error) return { ok: false, error: `No se ha podido eliminar: ${error.message}` };

  revalidatePath('/admin/participacion/categorias');
  return { ok: true };
}
