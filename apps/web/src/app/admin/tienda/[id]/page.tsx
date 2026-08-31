import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FormularioFichaProducto } from '@/components/tienda/FormularioFichaProducto';
import { requireEditor } from '@/lib/blog/guard';
import { obtenerFicha } from '@/lib/tienda/fichas';
import { obtenerProducto } from '@/lib/tienda/printful';

export const dynamic = 'force-dynamic';

export default async function FichaProductoAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireEditor();

  const productoId = Number.parseInt(id, 10);
  if (!Number.isFinite(productoId) || productoId <= 0) notFound();

  // Se comprueba contra Printful a propósito: así no se puede escribir la
  // ficha de un id que no existe (una fila huérfana que nadie vería nunca).
  const producto = await obtenerProducto(productoId).catch(() => null);
  if (!producto) notFound();

  const ficha = await obtenerFicha(productoId);

  return (
    <div className="py-2">
      <Link href="/admin/tienda" className="text-[14px] text-gris no-underline hover:underline">
        ← Volver a la tienda
      </Link>
      <h1 className="mb-6 mt-3 text-[24px] font-bold leading-tight text-titular min-[720px]:text-[32px]">
        {producto.nombre}
      </h1>
      <FormularioFichaProducto productoId={productoId} nombre={producto.nombre} ficha={ficha} />
    </div>
  );
}
