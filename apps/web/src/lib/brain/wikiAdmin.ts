'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { slugificar } from '@/lib/blog/markdown';
import { requireEditorCerebro } from './guard';
import { callBrainAdmin, BrainAdminNotConfiguredError } from './serviceClient';
import type { GraficoSpec } from './tipos';

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
 * Parsea y SANEA el campo `charts` (JSON del editor de gráficos). Nunca confía
 * en el cliente: descarta cualquier cosa que no cumpla la forma esperada, para
 * no guardar basura en la columna jsonb (0026). Cada gráfico debe tener al menos
 * una fila con etiqueta; cada valor se fuerza a número finito (0 si no lo es).
 */
function parsearGraficos(raw: string): GraficoSpec[] {
  let bruto: unknown;
  try {
    bruto = JSON.parse(raw || '[]');
  } catch {
    return [];
  }
  if (!Array.isArray(bruto)) return [];

  const salida: GraficoSpec[] = [];
  for (const item of bruto) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;

    const type = o.type === 'table' ? 'table' : 'bar';
    const title = typeof o.title === 'string' ? o.title.trim() : '';
    const unit = typeof o.unit === 'string' && o.unit.trim() ? o.unit.trim() : undefined;
    const note = typeof o.note === 'string' && o.note.trim() ? o.note.trim() : undefined;

    const filasBrutas = Array.isArray(o.data) ? o.data : [];
    const data = filasBrutas
      .map((f) => {
        const r = (f ?? {}) as Record<string, unknown>;
        const label = typeof r.label === 'string' ? r.label.trim() : '';
        const num = typeof r.value === 'number' ? r.value : Number(r.value);
        return { label, value: Number.isFinite(num) ? num : 0 };
      })
      .filter((f) => f.label !== '');

    if (data.length === 0) continue;
    salida.push({ type, title, ...(unit ? { unit } : {}), ...(note ? { note } : {}), data });
  }
  return salida;
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

  // Simulador HTML adjunto (0027). El admin lo sube desde el editor; se guarda
  // verbatim y se sirve aislado en un iframe sandbox. Aquí solo se valida el
  // tamaño (256 KB de sobra: el simulador de ejemplo pesa ~25 KB) y se
  // normaliza el vacío a NULL. El saneamiento contra XSS NO se hace aquí
  // (sería inútil: cualquier filtro de HTML se puede evadir): la seguridad la
  // da el sandbox + CSP del endpoint que lo sirve, nunca la confianza en el
  // contenido. Ver docs/tecnico/cerebro-participativo.md (D-CP-2).
  const embedHtmlBruto = texto(fd, 'embed_html');
  if (embedHtmlBruto.length > 256 * 1024) {
    return { ok: false, error: 'El simulador HTML supera el límite de 256 KB. Reduce su tamaño.' };
  }
  const embedHtml = embedHtmlBruto || null;
  const embedTitleBruto = texto(fd, 'embed_title').slice(0, 120);
  // Sin HTML no tiene sentido guardar un título de simulador.
  const embedTitle = embedHtml ? embedTitleBruto || 'Simulador' : null;

  const fila = {
    title,
    body,
    category_id: categoryId,
    area_id: areaIdTexto ? Number(areaIdTexto) : null,
    visibility,
    charts: parsearGraficos(texto(fd, 'charts')),
    embed_html: embedHtml,
    embed_title: embedTitle,
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

export interface ResultadoIndexado extends ResultadoAccion {
  entries_indexed?: number;
  chunks_inserted?: number;
  skipped?: number;
}

type RespuestaIngesta =
  | { ok: true; entries_indexed: number; chunks_inserted: number; skipped: number }
  | { ok: false; error: string };

/**
 * Dispara la ingesta bajo demanda en rc-brain-service (`POST /admin/ingest`),
 * botón "Indexar al cerebro" de /admin/cerebro.
 *
 * `mode: 'pending'` (uso normal) solo procesa las entradas sin
 * `indexed_at`; `mode: 'all'` reindexa todo (opción secundaria, para forzar
 * tras cambiar el modelo de embeddings, por ejemplo). El trabajo real
 * (generar embeddings, upsert en `brain_documents`, marcar `indexed_at`) lo
 * hace el servicio -- esta acción solo autentica al llamante (`is_editor`),
 * dispara la llamada y traduce la respuesta para la UI.
 *
 * Si `BRAIN_SERVICE_URL`/`INGEST_TRIGGER_SECRET` no están configurados en la
 * web, `callBrainAdmin` lanza `BrainAdminNotConfiguredError`: aquí se
 * convierte en un resultado controlado en vez de dejar que reviente la
 * Server Action.
 */
export async function indexarCerebro(mode: 'pending' | 'all' = 'pending'): Promise<ResultadoIndexado> {
  await requireEditorCerebro();

  let respuesta: { status: number; body: unknown };
  try {
    respuesta = await callBrainAdmin('/admin/ingest', { mode });
  } catch (e) {
    if (e instanceof BrainAdminNotConfiguredError) return { ok: false, error: e.message };
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'No se ha podido contactar con el cerebro.',
    };
  }

  const cuerpo = respuesta.body as RespuestaIngesta | null;

  if (!cuerpo || cuerpo.ok !== true) {
    const errorServicio = cuerpo && cuerpo.ok === false ? cuerpo.error : null;
    return {
      ok: false,
      error: errorServicio || `El cerebro respondió con un error (status ${respuesta.status}).`,
    };
  }

  revalidatePath('/admin/cerebro');
  return {
    ok: true,
    entries_indexed: cuerpo.entries_indexed,
    chunks_inserted: cuerpo.chunks_inserted,
    skipped: cuerpo.skipped,
  };
}
