/**
 * apps/web/src/lib/tienda/pedido.ts
 *
 * Codificación del carrito que viaja en la `metadata` de la sesión de Stripe,
 * y verificación del importe cobrado. Funciones PURAS, con tests.
 *
 * ⚠️ POR QUÉ ESTO EXISTE Y POR QUÉ ES CRÍTICO
 *
 * Entre que se crea la sesión de pago y que llega el webhook pasa tiempo, y
 * el navegador no vuelve a intervenir. El webhook necesita saber QUÉ se
 * compró para mandarlo a imprimir, y lo único que tiene es lo que dejamos en
 * la metadata de Stripe. Pero la metadata NO es una fuente de verdad de
 * precios: solo dice ids y cantidades. El importe se vuelve a calcular contra
 * Printful y se compara con lo que Stripe cobró de verdad (D-T3).
 *
 * Si esa comparación no cuadra, NO se fabrica nada: se registra el pedido
 * como fallido y se mira a mano. Fabricar sin cuadrar es enviar producto por
 * un dinero que no se ingresó.
 */

/** Clave de metadata con el carrito. */
export const META_LINEAS = 'rc_lineas';
/** Clave de metadata que marca la sesión como de la tienda (no afiliación). */
export const META_TIPO = 'rc_tipo';
export const TIPO_TIENDA = 'tienda';
/** Portes en céntimos, tal y como se cobraron. */
export const META_ENVIO = 'rc_envio_cents';

/** Stripe limita cada valor de metadata a 500 caracteres. */
const MAX_METADATA = 500;

export interface LineaPedido {
  variantId: number;
  cantidad: number;
}

/**
 * `[{5440442338, 2}, {5440442339, 1}]` -> `"5440442338:2,5440442339:1"`.
 *
 * Formato compacto a propósito: con JSON, un carrito de más de ~12 líneas se
 * pasaría de los 500 caracteres de Stripe y la sesión fallaría al crearse.
 */
export function codificarLineas(lineas: LineaPedido[]): string {
  const texto = lineas
    .filter((l) => Number.isFinite(l.variantId) && l.variantId > 0 && l.cantidad > 0)
    .map((l) => `${Math.trunc(l.variantId)}:${Math.trunc(l.cantidad)}`)
    .join(',');

  if (texto.length > MAX_METADATA) {
    throw new Error(
      `El carrito no cabe en la metadata de Stripe (${texto.length} > ${MAX_METADATA} caracteres). ` +
        'Reduce el número de líneas distintas.',
    );
  }
  return texto;
}

/** Inversa de `codificarLineas`. Descarta en silencio lo que no encaje. */
export function decodificarLineas(crudo: string | null | undefined): LineaPedido[] {
  return String(crudo ?? '')
    .split(',')
    .map((par) => par.trim())
    .filter(Boolean)
    .map((par) => {
      const [a, b] = par.split(':');
      return { variantId: Number.parseInt(a, 10), cantidad: Number.parseInt(b, 10) };
    })
    .filter((l) => Number.isFinite(l.variantId) && l.variantId > 0 && l.cantidad > 0);
}

export interface Verificacion {
  ok: boolean;
  esperadoCents: number;
  cobradoCents: number;
  motivo?: string;
}

/**
 * ¿Coincide lo que Stripe cobró con lo que valía el pedido?
 *
 * Se exige igualdad EXACTA, no una tolerancia. Un descuadre de un céntimo no
 * es "casi bien": significa que el precio cambió entre la sesión y el cobro, o
 * que alguien tocó algo. En ambos casos lo correcto es parar y mirarlo, no
 * fabricar y enviar.
 */
export function verificarImporte(opts: {
  subtotalCents: number;
  envioCents: number;
  cobradoCents: number | null | undefined;
}): Verificacion {
  const esperado = opts.subtotalCents + opts.envioCents;
  const cobrado = Number(opts.cobradoCents ?? 0);

  if (!Number.isFinite(cobrado) || cobrado <= 0) {
    return { ok: false, esperadoCents: esperado, cobradoCents: 0, motivo: 'Stripe no informó del importe cobrado.' };
  }
  if (cobrado !== esperado) {
    return {
      ok: false,
      esperadoCents: esperado,
      cobradoCents: cobrado,
      motivo: `El importe cobrado (${cobrado}) no coincide con el del pedido (${esperado}).`,
    };
  }
  return { ok: true, esperadoCents: esperado, cobradoCents: cobrado };
}
