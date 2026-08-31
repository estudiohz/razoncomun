/**
 * apps/web/src/lib/tienda/tipos.ts
 *
 * Tipos de la tienda (docs/tecnico/tienda-printful.md). El catálogo NO se
 * replica en Postgres (D-T1): estos tipos son la forma en que la app ve lo
 * que devuelve Printful, ya normalizado (la respuesta cruda de su API mezcla
 * `sync_product`/`sync_variants` y nombres en inglés).
 *
 * ⚠️ LOS DOS IDs DE VARIANTE (el error nº1 de esta integración, verificado
 * contra la API real el 14/08/2026):
 *   - `id`               -> id de la SYNC variant (la tuya, con tu diseño).
 *                           Es el que viaja en el carrito y en el pedido.
 *   - `catalogVariantId` -> id de la variante del CATÁLOGO de Printful
 *                           (el producto en blanco: talla/color).
 *                           Es el ÚNICO que acepta `/shipping/rates`.
 * Mandar el `id` donde va `catalogVariantId` devuelve
 * `400 Invalid variant ID` y deja el checkout sin poder calcular portes.
 */

/** Producto tal y como se pinta en la parrilla `/tienda` (D-T1). */
export interface ProductoResumen {
  id: number;
  nombre: string;
  /** Imagen cuadrada; en la parrilla manda la foto. */
  imagen: string | null;
  /** Nº de variantes sincronizadas (si es 1, la ficha oculta el selector). */
  numVariantes: number;
}

export interface VarianteTienda {
  /** SYNC variant id — carrito, pedido y metadata de Stripe. */
  id: number;
  /** CATÁLOGO — solo para `/shipping/rates`. Ver aviso de cabecera. */
  catalogVariantId: number;
  /** "S / Negro", "Talla única"… tal y como lo nombra Printful. */
  nombre: string;
  /** Precio de venta en céntimos (Printful lo da como "27.00" en EUR). */
  precioCents: number;
  moneda: string;
  /** Primera de `imagenes` — tarjeta de la parrilla y línea del carrito. */
  imagen: string | null;
  /**
   * Galería: TODOS los mockups (`files` de tipo `preview`) de esta variante,
   * ya deduplicados. Printful devuelve uno por vista que se eligiera al
   * crear el producto (frente, espalda, ambiente); si solo se eligió una,
   * aquí solo hay una y la ficha oculta la tira de miniaturas.
   */
  imagenes: string[];
  /** `availability_status === 'active'`: si no, no se puede comprar. */
  disponible: boolean;
}

export interface ProductoDetalle {
  id: number;
  nombre: string;
  imagen: string | null;
  variantes: VarianteTienda[];
}

/** Línea del carrito: el navegador solo guarda esto (D-T2), nunca precios. */
export interface ItemCarrito {
  /** SYNC variant id. */
  variantId: number;
  cantidad: number;
}

/** Tarifa devuelta por `/shipping/rates` para el destino indicado. */
export interface TarifaEnvio {
  id: string;
  nombre: string;
  precioCents: number;
  moneda: string;
  diasMin: number | null;
  diasMax: number | null;
}

/** Destino mínimo para calcular portes (D-T5: solo España en v1). */
export interface DestinoEnvio {
  paisCodigo: string;
  ciudad: string;
  codigoPostal: string;
}
