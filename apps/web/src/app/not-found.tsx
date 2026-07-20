import type { Metadata } from 'next';
import { Contenedor } from '@/components/layout/Contenedor';
import { Boton } from '@/components/ui/Boton';

export const metadata: Metadata = {
  title: 'Página no encontrada',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <Contenedor as="section" className="py-24 text-center">
      <div className="text-[64px] font-extrabold leading-none text-titular">404</div>
      <h1 className="mt-4 text-[clamp(24px,3vw,36px)] font-extrabold">
        Esta página no existe (todavía)
      </h1>
      <p className="mx-auto mt-3 max-w-[48ch] text-[16px] text-cuerpo">
        Puede que la estemos construyendo. Vuelve a la home o súmate a la comunidad.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3.5">
        <Boton href="/" variante="grad">
          Volver a la home
        </Boton>
        <Boton href="/manifiesto" variante="suave">
          Ver el manifiesto
        </Boton>
      </div>
    </Contenedor>
  );
}
