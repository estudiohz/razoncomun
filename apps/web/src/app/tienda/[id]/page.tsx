import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Contenedor } from '@/components/layout/Contenedor';
import { metadatosPagina } from '@/lib/seo';
import { obtenerProducto } from '@/lib/tienda/printful';
import { BotonCarrito } from '../BotonCarrito';
import { FichaCliente } from './FichaCliente';

export const revalidate = 3600;

function idValido(bruto: string): number | null {
  const n = Number.parseInt(bruto, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const numero = idValido(id);
  const producto = numero ? await obtenerProducto(numero).catch(() => null) : null;
  return metadatosPagina({
    titulo: producto?.nombre ?? 'Producto',
    descripcion: producto ? `${producto.nombre} — tienda de Razón Común.` : 'Tienda de Razón Común.',
    ruta: `/tienda/${id}`,
    noindex: true, // D-T10
  });
}

/** Ficha de producto: foto grande, precio, variante (si hay) y un solo botón. */
export default async function ProductoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numero = idValido(id);
  if (!numero) notFound();

  const producto = await obtenerProducto(numero);
  if (!producto) notFound();

  return (
    <Contenedor as="section" className="py-14">
      <div className="mb-8 flex items-center justify-between gap-4">
        <Link href="/tienda" className="text-[13.5px] font-bold text-gris no-underline hover:text-titular">
          ← Volver a la tienda
        </Link>
        <BotonCarrito />
      </div>

      <FichaCliente producto={producto} />
    </Contenedor>
  );
}
