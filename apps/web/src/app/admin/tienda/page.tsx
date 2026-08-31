import Link from 'next/link';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { requireEditor } from '@/lib/blog/guard';
import { fichaVacia, obtenerFichas } from '@/lib/tienda/fichas';
import { listarProductos, PrintfulNoConfiguradoError } from '@/lib/tienda/printful';

export const dynamic = 'force-dynamic';

/**
 * Lista de productos para redactar su ficha.
 *
 * Los productos los manda Printful (D-T1): aquí no se crean ni se borran, solo
 * se les escribe el texto que Printful no tiene. Por eso no hay botón de
 * "añadir producto" — se añade en Printful y aparece solo.
 */
export default async function TiendaAdminPage() {
  await requireEditor();

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[24px] font-extrabold">Tienda</h1>
        <p className="mt-1 text-[13.5px] text-gris">
          Descripción, guía de tallas, plazo de entrega y fotos de uso de cada producto. El
          catálogo (nombre, precio, variantes y mockups) se gestiona en Printful.
        </p>
      </div>

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
    </div>
  );
}
