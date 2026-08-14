import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Contenedor } from '@/components/layout/Contenedor';
import { metadatosPagina } from '@/lib/seo';
import { listarProductos, PrintfulNoConfiguradoError } from '@/lib/tienda/printful';
import { formatoPrecio } from '@/lib/tienda/precios';
import { obtenerProducto } from '@/lib/tienda/printful';
import { BotonCarrito } from './BotonCarrito';
import { TiendaNoConfigurada } from './TiendaNoConfigurada';

// D-T10: noindex y fuera del menú hasta el visto bueno legal.
export const metadata: Metadata = metadatosPagina({
  titulo: 'Tienda',
  descripcion: 'Merchandising de Razón Común. Cada compra sostiene el proyecto.',
  ruta: '/tienda',
  noindex: true,
});

// D-T1: Printful es la fuente del catálogo; ISR de 1 h.
export const revalidate = 3600;

/**
 * Parrilla de la tienda. Sergio: "muy visual, sencilla" — manda la foto;
 * debajo, solo nombre y precio. Sin badges, sin valoraciones y sin botón de
 * comprar en la tarjeta: un clic lleva a la ficha.
 */
export default async function TiendaPage() {
  let productos;
  try {
    productos = await listarProductos();
  } catch (err) {
    if (err instanceof PrintfulNoConfiguradoError) return <TiendaNoConfigurada />;
    throw err;
  }

  // El precio "desde" se saca de la ficha: la lista no lo trae. Son pocas
  // llamadas (decenas de productos) y van cacheadas 1 h con la parrilla.
  const detalles = await Promise.all(productos.map((p) => obtenerProducto(p.id)));
  const tarjetas = productos.map((p, i) => {
    const variantes = detalles[i]?.variantes ?? [];
    const disponibles = variantes.filter((v) => v.disponible);
    const desde = disponibles.length > 0 ? Math.min(...disponibles.map((v) => v.precioCents)) : null;
    return { ...p, desdeCents: desde, variasVariantes: disponibles.length > 1 };
  });

  return (
    <Contenedor as="section" className="py-14">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-[13px] font-bold uppercase tracking-[.14em] text-titular">Tienda</span>
          <h1 className="mt-3 text-[clamp(30px,4vw,44px)] font-extrabold leading-[1.12]">
            Lleva las ideas puestas
          </h1>
          <p className="mt-3 max-w-[560px] text-[16px] text-cuerpo">
            Merchandising de Razón Común. Se fabrica bajo pedido: sin almacén, sin excedentes.
          </p>
        </div>
        <BotonCarrito />
      </header>

      {tarjetas.length === 0 && (
        <p className="mt-12 text-center text-[15px] text-gris">Todavía no hay productos publicados.</p>
      )}

      <div className="mt-10 grid gap-6 min-[640px]:grid-cols-2 min-[960px]:grid-cols-3">
        {tarjetas.map((p) => (
          <Link
            key={p.id}
            href={`/tienda/${p.id}`}
            className="group block no-underline"
          >
            <div className="relative aspect-square overflow-hidden rounded-tarjeta bg-fondo">
              {p.imagen && (
                <Image
                  src={p.imagen}
                  alt={p.nombre}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 960px) 50vw, 33vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
              )}
            </div>
            <div className="mt-3 flex items-baseline justify-between gap-3">
              <h2 className="text-[16px] font-bold text-titular">{p.nombre}</h2>
              {p.desdeCents !== null && (
                <p className="shrink-0 text-[15px] font-extrabold text-titular tabular-nums">
                  {p.variasVariantes && <span className="text-[12px] font-bold text-gris">desde </span>}
                  {formatoPrecio(p.desdeCents)}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </Contenedor>
  );
}
