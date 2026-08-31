import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Contenedor } from '@/components/layout/Contenedor';
import { sanearHtml } from '@/lib/blog/html';
import { metadatosPagina } from '@/lib/seo';
import { obtenerFicha } from '@/lib/tienda/fichas';
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

  // Descripción, guía de tallas, plazo y fotos de uso (0052): lo que Printful
  // no trae. Un producto sin ficha se pinta igual, solo que sin esos bloques.
  const guardada = await obtenerFicha(producto.id);
  // El saneado se hace AQUÍ, en el servidor, y a FichaCliente (que es
  // 'use client') solo le llega HTML ya limpio: así `sanitize-html` no viaja
  // al navegador y ninguna fila de la BD alcanza el DOM sin pasar por la
  // lista blanca de lib/blog/html.ts.
  const ficha = {
    descripcionHtml: sanearHtml(guardada.description_html),
    guiaTallasHtml: sanearHtml(guardada.size_guide_html),
    plazoEntrega: guardada.delivery_note,
    fotosExtra: guardada.extra_images,
  };

  return (
    <Contenedor as="section" className="py-14">
      <div className="mb-8 flex items-center justify-between gap-4">
        <Link href="/tienda" className="text-[13.5px] font-bold text-gris no-underline hover:text-titular">
          ← Volver a la tienda
        </Link>
        <BotonCarrito />
      </div>

      <FichaCliente producto={producto} ficha={ficha} />

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
