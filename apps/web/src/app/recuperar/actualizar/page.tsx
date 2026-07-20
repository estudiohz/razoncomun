import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Contenedor } from '@/components/layout/Contenedor';
import { metadatosPagina } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';
import { ActualizarPasswordForm } from './ActualizarPasswordForm';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Nueva contraseña',
  descripcion: 'Elige una contraseña nueva para tu cuenta.',
  ruta: '/recuperar/actualizar',
  noindex: true,
});

export default async function ActualizarPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next = '/perfil' } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // /auth/confirm ya tuvo que establecer una sesión (verifyOtp type=recovery)
  // antes de redirigir aquí. Si no hay sesión, el enlace no era válido.
  if (!user) redirect('/recuperar?error=enlace_invalido');

  return (
    <Contenedor as="section" className="py-16">
      <div className="mx-auto w-full max-w-[420px]">
        <div className="text-center">
          <span className="text-[13px] font-bold uppercase tracking-[.14em] text-titular">
            Casi listo
          </span>
          <h1 className="mt-3 text-[clamp(28px,4vw,38px)] font-extrabold leading-[1.12]">
            Elige tu nueva contraseña
          </h1>
        </div>
        <div className="mt-8 rounded-tarjeta border border-linea bg-panel p-7 shadow-nav">
          <ActualizarPasswordForm next={next} />
        </div>
      </div>
    </Contenedor>
  );
}
