import Link from 'next/link';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { requireEditor } from '@/lib/blog/guard';
import { fichaVacia, obtenerFichas } from '@/lib/tienda/fichas';
import { estadoPedido, listarProductos, PrintfulNoConfiguradoError, type EstadoPedidoPrintful } from '@/lib/tienda/printful';
import { formatoPrecio } from '@/lib/tienda/precios';
import { tiendaEnModoCatalogo } from '@/lib/tienda/modo';
import { cambiarModoCatalogo } from './actions';

export const dynamic = 'force-dynamic';

/**
 * Lista de productos para redactar su ficha.
 *
 * Los productos los manda Printful (D-T1): aquí no se crean ni se borran, solo
 * se les escribe el texto que Printful no tiene. Por eso no hay botón de
 * "añadir producto" — se añade en Printful y aparece solo.
 */
/** Nuestro estado (0047) en palabras. */
const ESTADO_BD: Record<string, string> = {
  paid: 'Cobrado',
  sent_to_printful: 'Enviado a Printful',
  confirmed: 'Confirmado',
  failed: 'Fallido',
};

/** Estado de Printful en palabras. */
const ESTADO_PRINTFUL: Record<string, string> = {
  draft: 'Borrador',
  pending: 'Pendiente',
  failed: 'Error',
  canceled: 'Cancelado',
  inprocess: 'En producción',
  onhold: 'En espera',
  partial: 'Enviado en parte',
  fulfilled: 'Enviado',
};

interface FilaPedido {
  id: string;
  email: string;
  total_cents: number;
  shipping_cents: number;
  status: string;
  printful_order_id: number | null;
  printful_error: string | null;
  created_at: string;
}

export default async function TiendaAdminPage() {
  const { supabase } = await requireEditor();

  // RLS (0047): solo un ADMIN lee pedidos (llevan el email del comprador). A
  // un editor la consulta le devuelve vacío y la sección no se pinta.
  const { data: filasPedidos } = await supabase
    .from('shop_orders')
    .select('id, email, total_cents, shipping_cents, status, printful_order_id, printful_error, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  const pedidos = (filasPedidos ?? []) as FilaPedido[];

  // El estado VIVO de Printful: nuestra BD dice "Confirmado" en cuanto
  // Printful acepta el pedido, pero el cobro de la fabricación puede fallar
  // después (19/11/2026: "No payment method added"). Solo los 20 últimos.
  const estadosPrintful = new Map<string, EstadoPedidoPrintful>(
    await Promise.all(
      pedidos
        .filter((p) => p.printful_order_id)
        .map(async (p) => {
          try {
            return [p.id, await estadoPedido(p.printful_order_id as number)] as [string, EstadoPedidoPrintful];
          } catch {
            return [p.id, { estado: 'sin respuesta', error: null, articulos: [], costeCents: null }] as [string, EstadoPedidoPrintful];
          }
        }),
    ),
  );

  // Resumen. Ventas = todo lo cobrado (cada fila de shop_orders es un pago
  // confirmado por Stripe). Coste = lo que Printful cobra o cobrará: no
  // cuenta los cancelados, pero SÍ los fallidos por falta de pago, porque
  // esos hay que pagarlos igualmente para servir al cliente. La comisión de
  // Stripe no está incluida.
  const ventasCents = pedidos.reduce((s, p) => s + p.total_cents, 0);
  let costeCents = 0;
  let sinCoste = 0;
  for (const p of pedidos) {
    const v = estadosPrintful.get(p.id);
    if (v?.estado === 'canceled') continue;
    if (v?.costeCents == null) sinCoste++;
    else costeCents += v.costeCents;
  }
  const beneficioCents = ventasCents - costeCents;

  let productos;
  try {
    productos = await listarProductos();
  } catch (err) {
    return (
      <div className="space-y-6">
        <h1 className="text-[24px] font-extrabold">Tienda</h1>
        <Tarjeta className="p-6 text-[14px] text-cuerpo">
          {err instanceof PrintfulNoConfiguradoError
            ? 'Falta PRINTFUL_API_KEY en el entorno del servidor: sin ella no se puede listar el catálogo.'
            : 'No se ha podido consultar el catálogo de Printful. Vuelve a intentarlo en un momento.'}
        </Tarjeta>
      </div>
    );
  }

  const fichas = await obtenerFichas();
  const modoCatalogo = await tiendaEnModoCatalogo();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-extrabold">Tienda</h1>
          <p className="mt-1 text-[13.5px] text-gris">
            Descripción, guía de tallas, plazo de entrega y fotos de uso de cada producto. El
            catálogo (nombre, precio, variantes y mockups) se gestiona en Printful.
          </p>
        </div>
        <Link
          href="/admin/tienda/pagos"
          className="rounded-boton border border-linea bg-white px-5 py-2.5 text-[14px] font-bold text-titular"
        >
          Pagos
        </Link>
      </div>

      {pedidos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 min-[900px]:grid-cols-4">
          {[
            { titulo: 'Ventas realizadas', valor: String(pedidos.length), nota: '', negativo: false },
            { titulo: 'Importe de las ventas', valor: formatoPrecio(ventasCents), nota: 'Cobrado a los compradores', negativo: false },
            {
              titulo: 'Coste y envío (Printful)',
              valor: formatoPrecio(costeCents),
              nota: sinCoste > 0 ? `${sinCoste} pedido(s) sin coste en Printful` : 'Producto + envío + IVA',
              negativo: false,
            },
            {
              titulo: 'Beneficio',
              valor: formatoPrecio(beneficioCents),
              nota: 'Sin descontar la comisión de Stripe',
              negativo: beneficioCents < 0,
            },
          ].map((t) => (
            <Tarjeta key={t.titulo} className="p-4">
              <p className="text-[12px] font-bold uppercase tracking-wide text-gris">{t.titulo}</p>
              <p className={`mt-1.5 text-[24px] font-extrabold tabular-nums ${t.negativo ? 'text-red-700' : 'text-titular'}`}>
                {t.valor}
              </p>
              {t.nota && <p className="mt-0.5 text-[12px] text-gris">{t.nota}</p>}
            </Tarjeta>
          ))}
        </div>
      )}

      <Tarjeta className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-[15px] font-bold text-titular">
            {modoCatalogo ? 'Modo catálogo: activado' : 'Venta: abierta'}
          </p>
          <p className="mt-1 text-[13px] text-gris">
            {modoCatalogo
              ? 'Los productos se ven, pero no se puede comprar. Vuelve a abrir la venta cuando Printful tenga método de facturación.'
              : 'Se aceptan pedidos. Activa el modo catálogo si Printful no puede cobrar la fabricación.'}
          </p>
        </div>
        <form action={cambiarModoCatalogo}>
          <input type="hidden" name="activar" value={modoCatalogo ? '0' : '1'} />
          <button
            type="submit"
            className={
              modoCatalogo
                ? 'rounded-boton bg-accion px-5 py-2.5 text-[14px] font-bold text-white'
                : 'rounded-boton border border-linea bg-white px-5 py-2.5 text-[14px] font-bold text-titular'
            }
          >
            {modoCatalogo ? 'Abrir la venta' : 'Pasar a modo catálogo'}
          </button>
        </form>
      </Tarjeta>

      <Tarjeta className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-[13.5px]">
          <thead>
            <tr className="border-b border-linea text-[12px] uppercase tracking-wide text-gris">
              <th className="px-4 py-3">Producto</th>
              <th className="px-4 py-3">Ficha</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {productos.map((p) => {
              const ficha = fichas.get(p.id);
              const vacia = !ficha || fichaVacia(ficha);
              return (
                <tr key={p.id} className="border-b border-linea last:border-0">
                  <td className="px-4 py-3 font-semibold text-titular">{p.nombre}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        vacia
                          ? 'rounded-full bg-gris/15 px-2.5 py-1 text-[12px] font-bold text-gris'
                          : 'rounded-full bg-accion/10 px-2.5 py-1 text-[12px] font-bold text-accion'
                      }
                    >
                      {vacia ? 'Sin escribir' : 'Escrita'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/tienda/${p.id}`} className="font-bold text-titular">
                      Editar
                    </Link>
                  </td>
                </tr>
              );
            })}
            {productos.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-gris">
                  No hay productos publicados en Printful.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Tarjeta>

      {pedidos.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[18px] font-extrabold">Pedidos</h2>
          <Tarjeta className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-[13.5px]">
              <thead>
                <tr className="border-b border-linea text-[12px] uppercase tracking-wide text-gris">
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Comprador</th>
                  <th className="px-4 py-3">Artículos</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Printful</th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map((p) => {
                  const vivo = estadosPrintful.get(p.id);
                  const malPrintful = vivo?.estado === 'failed' || vivo?.estado === 'canceled';
                  const mal = p.status === 'failed' || malPrintful;
                  const motivo = p.printful_error ?? vivo?.error ?? null;
                  return (
                    <tr key={p.id} className="border-b border-linea align-top last:border-0">
                      <td className="whitespace-nowrap px-4 py-3 text-cuerpo">
                        {new Date(p.created_at).toLocaleString('es-ES', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                          timeZone: 'Europe/Madrid',
                        })}
                      </td>
                      <td className="px-4 py-3 text-titular">{p.email}</td>
                      <td className="px-4 py-3 text-cuerpo">
                        {vivo && vivo.articulos.length > 0 ? (
                          <ul className="space-y-0.5">
                            {vivo.articulos.map((a, i) => (
                              <li key={i}>
                                {a.cantidad} × {a.nombre}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-gris">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                        {formatoPrecio(p.total_cents)}
                        <span className="block text-[12px] text-gris">
                          envío {formatoPrecio(p.shipping_cents)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            mal
                              ? 'rounded-full bg-red-100 px-2.5 py-1 text-[12px] font-bold text-red-700'
                              : 'rounded-full bg-accion/10 px-2.5 py-1 text-[12px] font-bold text-accion'
                          }
                        >
                          {ESTADO_BD[p.status] ?? p.status}
                        </span>
                        {motivo && <p className="mt-1.5 max-w-[280px] text-[12px] text-red-700">{motivo}</p>}
                      </td>
                      <td className="px-4 py-3">
                        {p.printful_order_id ? (
                          <>
                            <a
                              href={`https://www.printful.com/dashboard/default/orders?order_id=${p.printful_order_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-bold text-titular"
                            >
                              #{p.printful_order_id}
                            </a>
                            {vivo && (
                              <span className={`block text-[12px] ${malPrintful ? 'font-bold text-red-700' : 'text-gris'}`}>
                                {ESTADO_PRINTFUL[vivo.estado] ?? vivo.estado}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-gris">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Tarjeta>
        </section>
      )}
    </div>
  );
}
