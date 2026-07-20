import type { Metadata } from 'next';
import { Contenedor } from '@/components/layout/Contenedor';
import { metadatosPagina } from '@/lib/seo';
import { RecuperarForm } from './RecuperarForm';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Recuperar acceso',
  descripcion: 'Recupera el acceso a tu cuenta de Razón Común.',
  ruta: '/recuperar',
  noindex: true,
});

export default function RecuperarPage() {
  return (
    <Contenedor as="section" className="py-16">
      <div className="mx-auto w-full max-w-[420px]">
        <div className="text-center">
          <span className="text-[13px] font-bold uppercase tracking-[.14em] text-titular">
            Sin problema
          </span>
          <h1 className="mt-3 text-[clamp(28px,4vw,38px)] font-extrabold leading-[1.12]">
            Recuperar acceso
          </h1>
          <p className="mx-auto mt-3 max-w-[38ch] text-[15px] text-cuerpo">
            Escribe tu email y te mandamos un enlace para poner una contraseña nueva.
          </p>
        </div>
        <div className="mt-8 rounded-tarjeta border border-linea bg-panel p-7 shadow-nav">
          <RecuperarForm />
        </div>
      </div>
    </Contenedor>
  );
}
