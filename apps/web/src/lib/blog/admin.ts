'use server';

import { revalidatePath } from 'next/cache';
import { emitirPublicacion } from './eventos';
import { BUCKET_PORTADAS, requireEditor } from './guard';
import { slugificar } from './markdown';
import type { ArticuloConRelaciones } from './tipos';

// `requireEditor` y `BUCKET_PORTADAS` viven en `./guard` porque este módulo es
// `'use server'`: solo puede exportar funciones async serializables, y aquellos
// son un valor y una función que devuelve un cliente de Supabase.

export interface ResultadoAccion {
  ok: boolean;
  error?: string;
  slug?: string;
  aviso?: string;
}

function texto(fd: FormData, campo: string): string {
  return String(fd.get(campo) ?? '').trim();
}

/**
 * Crea o actualiza un artículo.
 *
 * Reglas que se validan aquí (además de las del esquema):
 *  - Publicar exige al menos una fuente. El sello de trazabilidad es la marca
 *    de la casa: sin fuentes no se publica, y punto.
 *  - El slug no puede chocar con una categoría, porque `/blog/[slug]` resuelve
 *    primero categorías (ver `VistaSlug`) y el artículo quedaría inalcanzable.
 */
export async function guardarArticulo(
  _previo: ResultadoAccion | null,
  fd: FormData,
): Promise<ResultadoAccion> {
  const { supabase, userId } = await requireEditor();

  const id = texto(fd, 'id');
  const title = texto(fd, 'title');
  const body = texto(fd, 'body');
  const estado = texto(fd, 'status') === 'published' ? 'published' : 'draft';
  const slug = slugificar(texto(fd, 'slug') || title);
  const fuentes = texto(fd, 'source_urls')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  if (!title) return { ok: false, error: 'El título es obligatorio.' };
  if (!body) return { ok: false, error: 'El cuerpo del artículo es obligatorio.' };
  if (!slug) return { ok: false, error: 'No se ha podido generar un slug válido.' };
  if (estado === 'published' && fuentes.length === 0) {
    return {
      ok: false,
      error:
        'No se puede publicar sin al menos una fuente. El sello de trazabilidad es obligatorio.',
    };
  }

  const { data: choque } = await supabase
    .from('categories')
    .select('slug')
    .eq('slug', slug)
    .maybeSingle();
  if (choque) {
    return {
      ok: false,
      error: `El slug "${slug}" coincide con una categoría y el artículo quedaría inaccesible. Usa otro.`,
    };
  }

  const categoriaId = texto(fd, 'category_id');
  const fila = {
    slug,
    title,
    excerpt: texto(fd, 'excerpt') || null,
    body,
    category_id: categoriaId ? Number(categoriaId) : null,
    cover_image: texto(fd, 'cover_image') || null,
    source_type: texto(fd, 'source_type') === 'observatorio' ? 'observatorio' : 'editorial',
    source_urls: fuentes,
    status: estado,
    seo_title: texto(fd, 'seo_title') || null,
    seo_desc: texto(fd, 'seo_desc') || null,
  };

  // Solo se sella `published_at` la primera vez que pasa a publicado, para no
  // reescribir la fecha de publicación en cada edición posterior.
  let eraPublicado = false;
  if (id) {
    const { data: actual } = await supabase
      .from('articles')
      .select('status, published_at')
      .eq('id', id)
      .maybeSingle();
    eraPublicado = actual?.status === 'published';
  }

  const conFecha = {
    ...fila,
    ...(estado === 'published' && !eraPublicado ? { published_at: new Date().toISOString() } : {}),
    ...(id ? {} : { author_id: userId }),
  };

  const consulta = id
    ? supabase.from('articles').update(conFecha).eq('id', id)
    : supabase.from('articles').insert(conFecha);

  const { data, error } = await consulta.select('id').single();
  if (error) {
    return {
      ok: false,
      error:
        error.code === '23505'
          ? `Ya existe un artículo con el slug "${slug}".`
          : `No se ha podido guardar: ${error.message}`,
    };
  }

  // Evento de publicación: solo en la transición draft → published.
  let aviso: string | undefined;
  if (estado === 'published' && !eraPublicado) {
    const { data: completo } = await supabase
      .from('articles')
      .select(
        'id, slug, title, excerpt, body, category_id, cover_image, author_id, source_type, source_urls, status, published_at, seo_title, seo_desc, created_at, categoria:categories(id,slug,name,color), autor:profiles(id,display_name)',
      )
      .eq('id', data.id)
      .single();

    if (completo) {
      const uno = <T,>(v: unknown): T | null =>
        Array.isArray(v) ? ((v[0] as T) ?? null) : ((v as T) ?? null);
      const resultado = await emitirPublicacion({
        ...(completo as unknown as ArticuloConRelaciones),
        categoria: uno(completo.categoria),
        autor: uno(completo.autor),
      });
      if (!resultado.entregado) {
        aviso = `Artículo publicado, pero el evento para redes no se entregó (${resultado.motivo}). rc-08 puede reprocesarlo.`;
      }
    }
  }

  const base = fila.source_type === 'observatorio' ? '/observatorio' : '/blog';
  revalidatePath(base);
  revalidatePath(`${base}/${slug}`);
  revalidatePath('/sitemap.xml');

  return { ok: true, slug, aviso };
}

/**
 * Elimina uno o varios artículos (borrado en masa desde el listado).
 *
 * RLS (`articles_write_editor`, `for all`) ya exige `is_editor()`; `requireEditor`
 * es la segunda capa. No hay FKs entrantes hacia `articles`, así que el DELETE
 * no arrastra dependencias. La portada en Storage queda huérfana a propósito:
 * puede estar compartida y su limpieza no es crítica.
 */
export async function eliminarArticulos(ids: string[]): Promise<ResultadoAccion> {
  // `requireEditor()` puede llamar a `redirect()`, que funciona LANZANDO
  // `NEXT_REDIRECT`. Va FUERA del try de abajo a propósito: si lo envolviéramos,
  // el catch se tragaría ese control de flujo y el redirect no ocurriría.
  const { supabase } = await requireEditor();

  const limpios = Array.from(new Set((ids ?? []).map((s) => String(s).trim()).filter(Boolean)));
  if (limpios.length === 0) {
    return { ok: false, error: 'No hay artículos seleccionados.' };
  }

  // El borrado en masa puede FALLAR de dos formas distintas y hay que tratar
  // las dos: (1) error de base devuelto en `{ error }` (RLS, constraint…), y
  // (2) una EXCEPCIÓN lanzada por supabase-js si la capa REST/pg no responde
  // JSON válido (p. ej. timeout al borrar muchas filas, un 5xx con HTML). Sin
  // este try/catch, esa excepción sube sin capturar hasta el `useTransition`
  // del cliente y revienta la página entera con "client-side exception" en vez
  // de mostrar un error legible. Un mutador disparado por el usuario NUNCA debe
  // rechazar la promesa hacia el cliente: siempre devuelve un ResultadoAccion.
  try {
    const { error } = await supabase.from('articles').delete().in('id', limpios);
    if (error) {
      return { ok: false, error: `No se han podido eliminar: ${error.message}` };
    }
  } catch (e) {
    return {
      ok: false,
      error: `No se han podido eliminar (error de red o servidor): ${
        e instanceof Error ? e.message : 'error inesperado'
      }`,
    };
  }

  revalidatePath('/blog');
  revalidatePath('/observatorio');
  revalidatePath('/sitemap.xml');
  revalidatePath('/admin/articulos');

  return { ok: true };
}

/** Sube una portada al bucket público y devuelve su URL definitiva. */
export async function subirPortada(
  _previo: { url?: string; error?: string } | null,
  fd: FormData,
): Promise<{ url?: string; error?: string }> {
  const { supabase } = await requireEditor();

  const archivo = fd.get('archivo');
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: 'Selecciona una imagen.' };
  }
  if (!/^image\/(jpeg|png|webp|avif)$/.test(archivo.type)) {
    return { error: 'Formato no admitido. Usa JPG, PNG, WebP o AVIF.' };
  }
  if (archivo.size > 5 * 1024 * 1024) {
    return { error: 'La imagen supera los 5 MB.' };
  }

  const ext = archivo.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const ruta = `portadas/${Date.now()}-${slugificar(archivo.name.replace(/\.[^.]+$/, ''))}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET_PORTADAS)
    .upload(ruta, archivo, { cacheControl: '31536000', upsert: false });
  if (error) return { error: `No se ha podido subir: ${error.message}` };

  const { data } = supabase.storage.from(BUCKET_PORTADAS).getPublicUrl(ruta);
  return { url: data.publicUrl };
}
