import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Contenedor } from '@/components/layout/Contenedor';
import { metadatosPagina } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';
import { TEXTO_CONSENTIMIENTO } from '@/lib/auth/consentimiento';
import { aceptarConsentimiento } from './actions';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Un último paso',
  descripcion: 'Confirma tu consentimiento para continuar.',
  ruta: '/registro/consentimiento',
  noindex: true,
});

export default async function ConsentimientoPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next = '/perfil' } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/entrar');

  const { data: perfil } = await supabase
    .from('profiles')
    .select('privacy_consent_at')
    .eq('id', user.id)
    .single();

  if (perfil?.privacy_consent_at) redirect(next);

  return (
    <Contenedor as="section" className="py-16">
      <div className="mx-auto w-full max-w-[460px] rounded-tarjeta border border-linea bg-panel p-7 shadow-nav">
        <h1 className="text-[22px] font-extrabold">Un último paso</h1>
        <p className="mt-2 text-[14px] text-cuerpo">
          Antes de continuar necesitamos tu consentimiento explícito (art. 9 RGPD) — no lo pedimos
          durante tu alta porque entraste con Google/Facebook.
        </p>
        <form action={aceptarConsentimiento} className="mt-5 space-y-4">
          <input type="hidden" name="next" value={next} />
          <p className="rounded-boton border border-linea bg-fondo p-3.5 text-[12.5px] leading-relaxed text-cuerpo">
            {TEXTO_CONSENTIMIENTO}
          </p>
          <button
            type="submit"
            className="w-full rounded-boton bg-accion px-6 py-3 text-[15px] font-bold text-white shadow-boton hover:-translate-y-0.5"
          >
            Acepto y continúo
          </button>
        </form>
      </div>
    </Contenedor>
  );
}
