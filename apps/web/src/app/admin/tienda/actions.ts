'use server';

import { revalidatePath } from 'next/cache';
import { requireEditor } from '@/lib/blog/guard';
import { sanitizarHtml } from '@/lib/paginas';

export interface ResultadoFicha {
  ok: boolean;
  error?: string;
}

function texto(fd: FormData, campo: string): string {
  return String(fd.get(campo) ?? '').trim();
}

/** Límite sano: la galería de una ficha no es un álbum. */
const MAX_FOTOS = 8;

/**
 * Guarda la ficha editable de un producto de Printful (`shop_product_content`,
 * 0052). Es un upsert por `printful_product_id`: no hay "crear" ni "borrar"
 * desde la UI porque la lista de productos la manda Printful, no nosotros.
 *
 * El HTML se sanea al guardar Y se vuelve a sanear al renderizar la ficha
 * pública (regla de lib/blog/html.ts): esto es la primera capa, no la única.
 */
export async function guardarFichaProducto(
  _previo: ResultadoFicha | null,
  fd: FormData,
): Promise<ResultadoFicha> {
  const { supabase, userId } = await requireEditor();

  const printful_product_id = Number(texto(fd, 'printful_product_id'));
  if (!Number.isFinite(printful_product_id) || printful_product_id <= 0) {
    return { ok: false, error: 'Falta el producto al que pertenece la ficha.' };
  }

  const extra_images = texto(fd, 'extra_images')
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.startsWith('https://'))
    .slice(0, MAX_FOTOS);

  const { error } = await supabase.from('shop_product_content').upsert(
    {
      printful_product_id,
      description_html: sanitizarHtml(texto(fd, 'description_html')),
      size_guide_html: sanitizarHtml(texto(fd, 'size_guide_html')),
      delivery_note: texto(fd, 'delivery_note').slice(0, 120),
      extra_images,
      updated_by: userId,
    },
    { onConflict: 'printful_product_id' },
  );
  if (error) return { ok: false, error: `No se ha podido guardar: ${error.message}` };

  revalidatePath('/admin/tienda');
  revalidatePath(`/admin/tienda/${printful_product_id}`);
  // La ficha pública es ISR de 1 h (D-T1): sin esto el texto nuevo tardaría
  // hasta una hora en verse y parecería que no se ha guardado.
  revalidatePath(`/tienda/${printful_product_id}`);
  return { ok: true };
}
