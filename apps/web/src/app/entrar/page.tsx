import type { Metadata } from 'next';
import { Contenedor } from '@/components/layout/Contenedor';
import { metadatosPagina } from '@/lib/seo';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Entrar',
  descripcion: 'Accede a tu cuenta de Razón Común.',
  ruta: '/entrar',
  noindex: true,
});

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <Contenedor as="section" className="py-16">
      <div className="mx-auto w-full max-w-[440px]">
        <div className="text-center">
          <span className="text-[13px] font-bold uppercase tracking-[.14em] text-titular">
            Bienvenido de nuevo
          </span>
          <h1 className="mt-3 text-[clamp(28px,4vw,38px)] font-extrabold leading-[1.12]">Entrar</h1>
        </div>
        <div className="mt-8 rounded-tarjeta border border-linea bg-panel p-7 shadow-nav">
          {error ? (
            <p className="mb-4 rounded-boton bg-magenta/10 px-3.5 py-2.5 text-[13px] font-medium text-magenta">
              {mensajeError(error)}
            </p>
          ) : null}
          <LoginForm next={next ?? '/perfil'} />
        </div>
      </div>
    </Contenedor>
  );
}

function mensajeError(codigo: string) {
  if (codigo === 'enlace_invalido') return 'Ese enlace ya no es válido o ha caducado. Pide uno nuevo.';
  if (codigo === 'oauth_fallido') return 'No hemos podido completar el acceso con ese proveedor.';
  return 'Ha ocurrido un error. Inténtalo de nuevo.';
}
