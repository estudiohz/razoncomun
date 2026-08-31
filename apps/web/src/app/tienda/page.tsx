import type { Metadata } from 'next';
import { Contenedor } from '@/components/layout/Contenedor';
import { metadatosPagina } from '@/lib/seo';
import { PrintfulNoConfiguradoError } from '@/lib/tienda/printful';
import { BotonCarrito } from './BotonCarrito';
import { TarjetaProducto } from './TarjetaProducto';
import { tarjetasDeTienda } from './tarjetas';
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
  let tarjetas;
  try {
    tarjetas = await tarjetasDeTienda();
  } catch (err) {
    if (err instanceof PrintfulNoConfiguradoError) return <TiendaNoConfigurada />;
    throw err;
  }

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
          <TarjetaProducto
            key={p.id}
            producto={p}
            sizes="(max-width: 640px) 100vw, (max-width: 960px) 50vw, 33vw"
          />
        ))}
      </div>
    </Contenedor>
  );
}
