import type { Metadata } from 'next';
import { Contenedor } from '@/components/layout/Contenedor';
import { metadatosPagina } from '@/lib/seo';
import { ResumenCheckout } from './ResumenCheckout';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Tramitar pedido',
  descripcion: 'Resumen de tu pedido en la tienda de Razón Común.',
  ruta: '/tienda/checkout',
  noindex: true, // D-T10
});

export default function CheckoutPage() {
  return (
    <Contenedor as="section" className="py-14">
      {/* Sin envoltorio con max-w propio: `Contenedor` ya usa el mismo ancho
          (`max-w-wrap`, 1400px) que la cabecera — un tope aparte aquí solo
          la estrechaba respecto al resto de la web. */}
      <h1 className="text-[clamp(24px,3vw,34px)] font-extrabold leading-[1.15]">Tu pedido</h1>
      <p className="mt-2 text-[15px] text-cuerpo">Repasa lo que te llevas, calcula el envío y paga.</p>
      <div className="mt-8">
        <ResumenCheckout />
      </div>
    </Contenedor>
  );
}
