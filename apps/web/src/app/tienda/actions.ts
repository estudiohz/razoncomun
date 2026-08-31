'use server';

import { listarProductos, obtenerProducto } from '@/lib/tienda/printful';
import { subtotalCents } from '@/lib/tienda/precios';
import type { ItemCarrito, VarianteTienda } from '@/lib/tienda/tipos';

/**
 * Resuelve el carrito del navegador contra el catálogo REAL de Printful.
 *
 * D-T3, la regla que sostiene toda la tienda: el cliente manda solo
 * `{variantId, cantidad}` y el precio SIEMPRE sale de aquí. Si el precio
 * viniera del navegador, cualquiera podría comprar a 0 € con un `fetch`
 * manipulado. Esta función es la única fuente de importes del carrito y del
 * checkout (T2).
 */

export interface LineaCarrito {
  variante: VarianteTienda;
  productoId: number;
  productoNombre: string;
  cantidad: number;
  /** precio × cantidad, calculado en servidor. */
  totalLineaCents: number;
}

/** Línea del carrito que ya no se puede comprar (agotada o borrada en Printful). */
export interface LineaNoDisponible {
  variantId: number;
  /** Nombre si todavía existe en el catálogo (solo está agotada); `null` si ya no existe. */
  nombre: string | null;
}

export interface CarritoResuelto {
  lineas: LineaCarrito[];
  subtotalCents: number;
  /** Variantes del carrito que ya no existen o están agotadas en Printful. */
  noDisponibles: LineaNoDisponible[];
}

export async function resolverCarritoAction(items: ItemCarrito[]): Promise<CarritoResuelto> {
  const pedidos = (Array.isArray(items) ? items : [])
    .map((i) => ({ variantId: Number(i?.variantId), cantidad: Math.max(1, Math.min(20, Number(i?.cantidad) || 0)) }))
    .filter((i) => Number.isFinite(i.variantId) && i.variantId > 0);

  if (pedidos.length === 0) return { lineas: [], subtotalCents: 0, noDisponibles: [] };

  // El catálogo es pequeño (decenas de productos) y va con ISR de 1 h, así
  // que recorrerlo entero es más simple y barato que mantener un índice.
  const productos = await listarProductos();
  const detalles = await Promise.all(productos.map((p) => obtenerProducto(p.id)));

  const indice = new Map<number, { variante: VarianteTienda; productoId: number; productoNombre: string }>();
  for (const d of detalles) {
    if (!d) continue;
    for (const v of d.variantes) {
      indice.set(v.id, { variante: v, productoId: d.id, productoNombre: d.nombre });
    }
  }

  const lineas: LineaCarrito[] = [];
  const noDisponibles: LineaNoDisponible[] = [];

  for (const item of pedidos) {
    const encontrada = indice.get(item.variantId);
    if (!encontrada || !encontrada.variante.disponible) {
      // Si sigue en el índice solo está agotada (se sabe su nombre); si no
      // está, es que el producto o la variante ya no existen en Printful.
      noDisponibles.push({ variantId: item.variantId, nombre: encontrada?.variante.nombre ?? null });
      continue;
    }
    lineas.push({
      variante: encontrada.variante,
      productoId: encontrada.productoId,
      productoNombre: encontrada.productoNombre,
      cantidad: item.cantidad,
      totalLineaCents: encontrada.variante.precioCents * item.cantidad,
    });
  }

  return {
    lineas,
    subtotalCents: subtotalCents(
      lineas.map((l) => ({ precioCents: l.variante.precioCents, cantidad: l.cantidad })),
    ),
    noDisponibles,
  };
}
