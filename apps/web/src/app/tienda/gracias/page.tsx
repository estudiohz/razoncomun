import type { Metadata } from 'next';
import Link from 'next/link';
import { Contenedor } from '@/components/layout/Contenedor';
import { metadatosPagina } from '@/lib/seo';
import { VaciarCarrito } from './VaciarCarrito';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Pedido recibido',
  descripcion: 'Gracias por tu compra en la tienda de Razón Común.',
  ruta: '/tienda/gracias',
  noindex: true, // D-T10
});

/**
 * Vuelta desde Stripe. Deliberadamente NO consulta el estado del pedido: el
 * pago lo confirma el webhook, no esta página. Si alguien abre esta URL a
 * mano no ve nada que no debiera, y si el navegador se cierra tras pagar el
 * pedido se procesa igual.
 */
export default function GraciasPage() {
  return (
    <Contenedor as="section" className="py-20">
      <div className="mx-auto max-w-[560px] text-center">
        <p className="text-[13px] font-bold uppercase tracking-[.14em] text-titular">Pedido recibido</p>
        <h1 className="mt-3 text-[clamp(26px,3.4vw,38px)] font-extrabold leading-[1.15]">
          Gracias. Ya estamos con ello.
        </h1>
        <p className="mt-4 text-[16px] leading-[1.6] text-cuerpo">
          Te hemos enviado el recibo por correo. Se fabrica bajo pedido, así que tarda unos días más
          que una tienda con almacén: cuando salga hacia tu casa recibirás el seguimiento.
        </p>
        <p className="mt-4 rounded-[14px] border border-linea bg-panel px-4 py-3 text-[14px] text-cuerpo">
          Lo que has pagado va íntegro a sostener el proyecto. Queda reflejado en la sección de{' '}
          <Link href="/cuentas" className="font-bold text-titular underline underline-offset-2">
            cuentas
          </Link>
          .
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/tienda"
            className="rounded-boton bg-accion px-6 py-3 text-[15px] font-bold text-white no-underline shadow-boton"
          >
            Volver a la tienda
          </Link>
          <Link
            href="/"
            className="rounded-boton border border-linea bg-white px-6 py-3 text-[15px] font-bold text-titular no-underline"
          >
            Ir al inicio
          </Link>
        </div>
      </div>

      <VaciarCarrito />
    </Contenedor>
  );
}
