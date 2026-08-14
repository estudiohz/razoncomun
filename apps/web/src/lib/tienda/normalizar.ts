/**
 * apps/web/src/lib/tienda/normalizar.ts
 *
 * Funciones PURAS que traducen la respuesta cruda de Printful a los tipos de
 * la app, y que construyen los `items` de cada endpoint con el id correcto.
 * Están separadas del cliente HTTP (`printful.ts`) a propósito: así se pueden
 * probar sin red — y la prueba que importa es que NUNCA se mande el sync id
 * donde va el id de catálogo (ver tipos.ts y `normalizar.test.ts`).
 */
import type { ProductoDetalle, ProductoResumen, TarifaEnvio, VarianteTienda } from './tipos';

/** "27.00" -> 2700. Printful manda el precio como string decimal. */
export function precioACents(valor: unknown): number {
  const n = typeof valor === 'number' ? valor : Number.parseFloat(String(valor ?? ''));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

type Crudo = Record<string, unknown>;

function texto(v: unknown): string {
  return typeof v === 'string' ? v : '';
}
function numero(v: unknown): number {
  const n = typeof v === 'number' ? v : Number.parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : 0;
}

/** Fila de `GET /store/products` -> tarjeta de la parrilla. */
export function normalizarResumen(crudo: Crudo): ProductoResumen {
  return {
    id: numero(crudo.id),
    nombre: texto(crudo.name),
    imagen: texto(crudo.thumbnail_url) || null,
    numVariantes: numero(crudo.variants),
  };
}

/**
 * `GET /store/products/{id}` -> ficha. Aquí es donde se separan los dos ids:
 * `sync_variant.id` (nuestro) y `sync_variant.variant_id` (catálogo).
 */
export function normalizarDetalle(resultado: Crudo): ProductoDetalle | null {
  const producto = (resultado?.sync_product ?? null) as Crudo | null;
  if (!producto) return null;
  const crudas = Array.isArray(resultado?.sync_variants) ? (resultado.sync_variants as Crudo[]) : [];

  const variantes: VarianteTienda[] = crudas.map((v) => {
    const anidado = (v.product ?? {}) as Crudo;
    return {
      id: numero(v.id),
      // `variant_id` vive tanto en la raíz de la sync variant como en
      // `product.variant_id`; se toma el primero que exista, nunca `v.id`.
      catalogVariantId: numero(v.variant_id ?? anidado.variant_id),
      nombre: texto(v.name),
      precioCents: precioACents(v.retail_price),
      moneda: texto(v.currency) || 'EUR',
      imagen: texto(anidado.image) || texto(producto.thumbnail_url) || null,
      disponible: texto(v.availability_status) === 'active',
    };
  });

  return {
    id: numero(producto.id),
    nombre: texto(producto.name),
    imagen: texto(producto.thumbnail_url) || null,
    variantes,
  };
}

/** Fila de `POST /shipping/rates` -> tarifa. */
export function normalizarTarifa(crudo: Crudo): TarifaEnvio {
  return {
    id: texto(crudo.id),
    // Printful mete word-joiners (⁠) en el nombre; se limpian para no
    // arrastrar caracteres invisibles a la UI.
    nombre: texto(crudo.name).replace(/[⁠​]/g, '').trim(),
    precioCents: precioACents(crudo.rate),
    moneda: texto(crudo.currency) || 'EUR',
    diasMin: crudo.minDeliveryDays == null ? null : numero(crudo.minDeliveryDays),
    diasMax: crudo.maxDeliveryDays == null ? null : numero(crudo.maxDeliveryDays),
  };
}

export interface LineaResuelta {
  variante: VarianteTienda;
  cantidad: number;
}

/**
 * Items para `POST /shipping/rates`: usa el id de CATÁLOGO. Lanza si alguna
 * variante no lo trae, en vez de mandar un 0 o el sync id y comerse un
 * `400 Invalid variant ID` con el usuario esperando en el checkout.
 */
export function itemsParaTarifas(lineas: LineaResuelta[]): { variant_id: number; quantity: number }[] {
  return lineas.map(({ variante, cantidad }) => {
    if (!variante.catalogVariantId) {
      throw new Error(
        `La variante ${variante.id} no tiene catalogVariantId: /shipping/rates lo exige (ver lib/tienda/tipos.ts).`,
      );
    }
    return { variant_id: variante.catalogVariantId, quantity: cantidad };
  });
}

/**
 * Items para `POST /orders`: usa el id de SYNC — es el que lleva asociados
 * los ficheros de diseño. Mandar aquí el de catálogo imprimiría el producto
 * en blanco, sin el logo.
 */
export function itemsParaPedido(lineas: LineaResuelta[]): { sync_variant_id: number; quantity: number }[] {
  return lineas.map(({ variante, cantidad }) => ({
    sync_variant_id: variante.id,
    quantity: cantidad,
  }));
}
