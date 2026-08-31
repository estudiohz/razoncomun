import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Contenedor } from '@/components/layout/Contenedor';
import { metadatosPagina } from '@/lib/seo';
import { obtenerProducto, PrintfulNoConfiguradoError } from '@/lib/tienda/printful';
import { BotonCarrito } from '../BotonCarrito';
import { TarjetaProducto } from '../TarjetaProducto';
import { tarjetasDeTienda } from '../tarjetas';
import { TiendaNoConfigurada } from '../TiendaNoConfigurada';
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

  // Sin la key, `obtenerProducto` lanza: hay que degradar igual que la
  // parrilla o la ficha responde 500 (pasó al desplegar T1).
  let producto;
  try {
    producto = await obtenerProducto(numero);
  } catch (err) {
    if (err instanceof PrintfulNoConfiguradoError) return <TiendaNoConfigurada />;
    throw err;
  }
  if (!producto) notFound();

  // "Otros productos" (Sergio, 31/08/2026): 3 fichas para no dejar la página
  // sin salida. Va cacheado con el resto del catálogo (ISR 1 h) y si falla no
  // se lleva la ficha por delante — es un extra, no el contenido.
  const otros = await tarjetasDeTienda()
    .then((t) => t.filter((p) => p.id !== producto.id).slice(0, 3))
    .catch(() => []);

  return (
    <Contenedor as="section" className="py-14">
      <div className="mb-8 flex items-center justify-between gap-4">
        <Link href="/tienda" className="text-[13.5px] font-bold text-gris no-underline hover:text-titular">
          ← Volver a la tienda
        </Link>
        <BotonCarrito />
      </div>

      <FichaCliente producto={producto} />

      {otros.length > 0 && (
        <section className="mt-16 border-t border-linea pt-12">
          <h2 className="text-[clamp(20px,2.4vw,26px)] font-extrabold leading-[1.15] text-titular">
            Otros productos que te pueden interesar
          </h2>
          <div className="mt-6 grid gap-6 min-[640px]:grid-cols-3">
            {otros.map((p) => (
              <TarjetaProducto
                key={p.id}
                producto={p}
                sizes="(max-width: 640px) 100vw, 33vw"
              />
            ))}
          </div>
        </section>
      )}
    </Contenedor>
  );
}
