import type { Metadata } from 'next';
import { Contenedor } from '@/components/layout/Contenedor';
import { metadatosPagina } from '@/lib/seo';
import { Desafio2FA } from './Desafio2FA';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Verificación en dos pasos',
  descripcion: 'Introduce el código de tu app de autenticación.',
  ruta: '/entrar/2fa',
  noindex: true,
});

export default async function Entrar2FAPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; motivo?: string }>;
}) {
  const { next = '/perfil', motivo } = await searchParams;

  return (
    <Contenedor as="section" className="py-16">
      <div className="mx-auto w-full max-w-[420px]">
        <div className="text-center">
          <span className="text-[13px] font-bold uppercase tracking-[.14em] text-titular">
            Un paso más
          </span>
          <h1 className="mt-3 text-[clamp(26px,3.6vw,34px)] font-extrabold leading-[1.12]">
            Verificación en dos pasos
          </h1>
          {motivo === 'admin' ? (
            <p className="mx-auto mt-3 max-w-[38ch] text-[14px] text-cuerpo">
              Tu cuenta tiene un cargo o rol que exige 2FA activo para entrar al panel de
              administración.
            </p>
          ) : null}
        </div>
        <div className="mt-8 rounded-tarjeta border border-linea bg-panel p-7 shadow-nav">
          <Desafio2FA next={next} />
        </div>
      </div>
    </Contenedor>
  );
}
