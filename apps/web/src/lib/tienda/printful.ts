/**
 * apps/web/src/lib/tienda/printful.ts
 *
 * Cliente REST de Printful — SERVER ONLY (la key permite hacer pedidos que
 * cuestan dinero real: jamás debe llegar al navegador).
 *
 * Solo se usan endpoints verificados contra la cuenta real el 14/08/2026
 * (`/store/products`, `/store/products/{id}`, `/shipping/rates`, `/orders`):
 * la key de Sergio tiene scopes limitados — `/countries`, por ejemplo,
 * devuelve 403. Si hiciera falta uno nuevo, pedirle una key con más permisos
 * en vez de buscar un rodeo.
 *
 * El mapeo de la respuesta cruda y, sobre todo, la elección del id de
 * variante correcto para cada endpoint viven en `normalizar.ts` (puro y con
 * tests). Aquí solo está el HTTP.
 */
import 'server-only';
import {
  itemsParaPedido,
  itemsParaTarifas,
  normalizarDetalle,
  normalizarResumen,
  normalizarTarifa,
  type LineaResuelta,
} from './normalizar';
import type { DestinoEnvio, ProductoDetalle, ProductoResumen, TarifaEnvio } from './tipos';

const BASE = 'https://api.printful.com';

export class PrintfulNoConfiguradoError extends Error {
  constructor() {
    super('Falta PRINTFUL_API_KEY en el entorno del servidor (ver docs/tecnico/tienda-printful.md §6).');
    this.name = 'PrintfulNoConfiguradoError';
  }
}

export class PrintfulError extends Error {
  readonly status: number;
  constructor(status: number, mensaje: string) {
    super(`Printful devolvió ${status}: ${mensaje}`);
    this.name = 'PrintfulError';
    this.status = status;
  }
}

function clave(): string {
  const k = process.env.PRINTFUL_API_KEY;
  if (!k) throw new PrintfulNoConfiguradoError();
  return k;
}

async function llamar<T = unknown>(
  ruta: string,
  opciones: { metodo?: 'GET' | 'POST'; cuerpo?: unknown; revalidate?: number } = {},
): Promise<T> {
  const { metodo = 'GET', cuerpo, revalidate } = opciones;

  const res = await fetch(`${BASE}${ruta}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${clave()}`,
      ...(cuerpo ? { 'Content-Type': 'application/json' } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    // ISR (D-T1) solo en lecturas de catálogo; los cálculos de envío y los
    // pedidos NUNCA se cachean.
    ...(revalidate !== undefined ? { next: { revalidate } } : { cache: 'no-store' as const }),
  });

  const texto = await res.text();
  let json: { result?: unknown; error?: { message?: string } } = {};
  try {
    json = texto ? JSON.parse(texto) : {};
  } catch {
    throw new PrintfulError(res.status, `respuesta no-JSON (${texto.slice(0, 120)})`);
  }
  if (!res.ok) throw new PrintfulError(res.status, json?.error?.message ?? texto.slice(0, 200));
  return json.result as T;
}

/** Catálogo de la parrilla. Cacheado 1 h (D-T1): el panel de Printful es el admin. */
export async function listarProductos(): Promise<ProductoResumen[]> {
  const crudo = await llamar<Record<string, unknown>[]>('/store/products', { revalidate: 3600 });
  return (Array.isArray(crudo) ? crudo : [])
    .filter((p) => !p.is_ignored)
    .map(normalizarResumen)
    .filter((p) => p.id > 0);
}

/** Ficha de producto. `null` si no existe (la página responde 404). */
export async function obtenerProducto(id: number): Promise<ProductoDetalle | null> {
  try {
    const crudo = await llamar<Record<string, unknown>>(`/store/products/${id}`, { revalidate: 3600 });
    return normalizarDetalle(crudo);
  } catch (err) {
    if (err instanceof PrintfulError && err.status === 404) return null;
    throw err;
  }
}

/**
 * Tarifas reales de envío (D-T5). Usa el id de CATÁLOGO de cada variante:
 * `itemsParaTarifas` lo garantiza y lanza si falta.
 */
export async function calcularEnvio(lineas: LineaResuelta[], destino: DestinoEnvio): Promise<TarifaEnvio[]> {
  if (lineas.length === 0) return [];
  const crudo = await llamar<Record<string, unknown>[]>('/shipping/rates', {
    metodo: 'POST',
    cuerpo: {
      recipient: {
        country_code: destino.paisCodigo,
        city: destino.ciudad,
        zip: destino.codigoPostal,
      },
      items: itemsParaTarifas(lineas),
      currency: 'EUR',
      locale: 'es_ES',
    },
  });
  return (Array.isArray(crudo) ? crudo : []).map(normalizarTarifa);
}

export interface DatosPedido {
  /** `session.id` de Stripe: hace el pedido idempotente del lado de Printful (D-T6). */
  externalId: string;
  destinatario: {
    nombre: string;
    direccion1: string;
    ciudad: string;
    codigoPostal: string;
    paisCodigo: string;
    email: string;
  };
  lineas: LineaResuelta[];
}

/**
 * Crea el pedido en Printful como BORRADOR (`confirmed: false`, D-T7): no
 * entra en producción hasta que se confirma tras verificar el cobro. Usa el
 * id de SYNC (lleva los ficheros del diseño).
 */
export async function crearPedido(datos: DatosPedido): Promise<{ id: number }> {
  const resultado = await llamar<{ id: number }>('/orders?confirm=false', {
    metodo: 'POST',
    cuerpo: {
      external_id: datos.externalId,
      recipient: {
        name: datos.destinatario.nombre,
        address1: datos.destinatario.direccion1,
        city: datos.destinatario.ciudad,
        zip: datos.destinatario.codigoPostal,
        country_code: datos.destinatario.paisCodigo,
        email: datos.destinatario.email,
      },
      items: itemsParaPedido(datos.lineas),
    },
  });
  return resultado;
}

/** Confirma un pedido ya creado (paso final de T2, tras verificar el importe). */
export async function confirmarPedido(printfulOrderId: number): Promise<void> {
  await llamar(`/orders/${printfulOrderId}/confirm`, { metodo: 'POST' });
}
