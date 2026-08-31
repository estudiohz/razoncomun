import { createClient } from '@/lib/supabase/server';

/**
 * Ficha editable de un producto (`public.shop_product_content`, 0052).
 *
 * Es lo ÚNICO de la tienda que no viene de Printful: descripción, guía de
 * tallas, plazo de entrega y fotos de uso. Printful no tiene esos campos y
 * son justo los que responden a las objeciones de compra.
 */
export interface FichaProducto {
  printful_product_id: number;
  description_html: string;
  size_guide_html: string;
  delivery_note: string;
  extra_images: string[];
}

export const FICHA_VACIA: Omit<FichaProducto, 'printful_product_id'> = {
  description_html: '',
  size_guide_html: '',
  delivery_note: '',
  extra_images: [],
};

function normalizar(fila: Record<string, unknown> | null, id: number): FichaProducto {
  return {
    printful_product_id: id,
    description_html: String(fila?.description_html ?? ''),
    size_guide_html: String(fila?.size_guide_html ?? ''),
    delivery_note: String(fila?.delivery_note ?? ''),
    extra_images: Array.isArray(fila?.extra_images)
      ? (fila.extra_images as unknown[]).map(String).filter(Boolean)
      : [],
  };
}

/**
 * Ficha de un producto. Nunca devuelve `null`: un producto sin ficha es lo
 * normal (recién creado en Printful) y debe pintarse igual, solo que sin los
 * bloques de texto. Si la consulta falla tampoco tumba la página — el
 * catálogo es Printful, esto es el complemento.
 */
export async function obtenerFicha(printfulProductId: number): Promise<FichaProducto> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('shop_product_content')
      .select('*')
      .eq('printful_product_id', printfulProductId)
      .maybeSingle();
    return normalizar(data as Record<string, unknown> | null, printfulProductId);
  } catch {
    return { printful_product_id: printfulProductId, ...FICHA_VACIA };
  }
}

/** Todas las fichas indexadas por id — para la lista de /admin/tienda. */
export async function obtenerFichas(): Promise<Map<number, FichaProducto>> {
  const supabase = await createClient();
  const { data } = await supabase.from('shop_product_content').select('*');
  const mapa = new Map<number, FichaProducto>();
  for (const fila of (data ?? []) as Record<string, unknown>[]) {
    const id = Number(fila.printful_product_id);
    if (Number.isFinite(id)) mapa.set(id, normalizar(fila, id));
  }
  return mapa;
}

/** ¿Tiene algo escrito? Decide el "sin ficha" de la lista del admin. */
export function fichaVacia(f: FichaProducto): boolean {
  return (
    !f.description_html.trim() &&
    !f.size_guide_html.trim() &&
    !f.delivery_note.trim() &&
    f.extra_images.length === 0
  );
}
