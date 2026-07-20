import type { Metadata } from 'next';
import { Contenedor } from '@/components/layout/Contenedor';
import { metadatosPagina } from '@/lib/seo';
import { RegistroForm } from './RegistroForm';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Crear cuenta',
  descripcion: 'Crea tu cuenta de Razón Común: solo pedimos tu email.',
  ruta: '/registro',
  noindex: true,
});

export default function RegistroPage() {
  return (
    <Contenedor as="section" className="py-16">
      <div className="mx-auto w-full max-w-[460px]">
        <div className="text-center">
          <span className="text-[13px] font-bold uppercase tracking-[.14em] text-titular">
            Únete
          </span>
          <h1 className="mt-3 text-[clamp(28px,4vw,38px)] font-extrabold leading-[1.12]">
            Crea tu cuenta
          </h1>
          <p className="mx-auto mt-3 max-w-[40ch] text-[15px] text-cuerpo">
            Mínimo dato: solo tu email. Nada de DNI, ni teléfono, ni dirección.
          </p>
        </div>
        <div className="mt-8 rounded-tarjeta border border-linea bg-panel p-7 shadow-nav">
          <RegistroForm />
        </div>
      </div>
    </Contenedor>
  );
}
