import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { metadatosPagina } from '@/lib/seo';
import { requireUsuario } from '@/lib/auth/niveles';
import { PerfilDatosForm } from '@/components/perfil/PerfilDatosForm';
import { ContrasenaForm } from '@/components/perfil/ContrasenaForm';
import { Seguridad2FA } from '@/components/perfil/Seguridad2FA';
import { ExportarBorrarCuenta } from '@/components/perfil/ExportarBorrarCuenta';
import { VerificarIdentidad } from '@/components/perfil/VerificarIdentidad';
import { NotificacionesPushForm } from '@/components/perfil/NotificacionesPushForm';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Mi perfil',
  descripcion: 'Tus datos personales en Razón Común.',
  ruta: '/panel/perfil',
  noindex: true,
});

const NOMBRE_NIVEL: Record<string, string> = {
  registered: 'Registrado',
  member: 'Afiliado',
  verified: 'Afiliado verificado',
};

/**
 * Perfil del usuario dentro del panel (U1). Es la antigua `/perfil`, que ahora
 * redirige aquí (308) — ver app/perfil/page.tsx. Lo que se movió es solo la
 * ubicación: los formularios son los mismos, reubicados a components/perfil/
 * para que no vivan colgando de una ruta que ya solo redirige.
 *
 * Lo que ANTES estaba aquí y ahora vive en otras secciones del panel:
 * afiliación y certificados → /panel/afiliacion; "Mis votos" → /panel/propuestas.
 */
export default async function PanelPerfilPage() {
  const { user, perfil, supabase } = await requireUsuario('/panel/perfil');
  if (!perfil) redirect('/entrar');

  const [{ data: provincias }, { data: cargos }] = await Promise.all([
    supabase.from('territories').select('id, name').eq('type', 'province').order('name'),
    supabase
      .from('positions')
      .select('role, scope, started_at')
      .eq('user_id', user.id)
      .is('ended_at', null),
    ]);

  const { data: tieneContrasena } = await supabase.rpc('has_password');

  return (
    <div className="mx-auto w-full max-w-[760px] space-y-6">
      <header>
        <h1 className="text-[clamp(24px,3.4vw,32px)] font-extrabold leading-tight">Mi perfil</h1>
        <p className="mt-1 text-[14px] text-gris">{user.email}</p>
      </header>

      {/* NIVEL */}
      <section className="rounded-tarjeta border border-linea bg-panel p-6 shadow-nav">
        <h2 className="text-[15px] font-bold text-titular">Tu nivel</h2>
        <p className="mt-2 text-[22px] font-extrabold">
          {NOMBRE_NIVEL[perfil.level] ?? perfil.level}
        </p>
        {cargos && cargos.length > 0 && (
          <p className="mt-1 text-[13px] text-cuerpo">
            Cargo vigente: {cargos.map((c) => c.role).join(', ')}
          </p>
        )}
        <div id="verificacion" className="mt-4 scroll-mt-24 space-y-3 text-[13.5px] text-cuerpo">
          {perfil.level === 'registered' && (
            <p>
              Hazte afiliado para votar en las propuestas de departamento.{' '}
              <a href="/panel/afiliacion" className="font-semibold text-titular underline">
                Ver cómo afiliarte
              </a>
              .
            </p>
          )}
          {perfil.level === 'member' && (
            <div>
              <p className="mb-2">
                Verifica tu identidad con Stripe Identity para votar cambios del manifiesto y ser
                elegible para listas/cargos internos.
              </p>
              <VerificarIdentidad />
            </div>
          )}
          {perfil.level === 'verified' && (
            <p>
              Tienes el nivel máximo. Verificado el {formatearFecha(perfil.identity_verified_at)}.
            </p>
          )}
        </div>
      </section>

      {/* DATOS */}
      <section className="rounded-tarjeta border border-linea bg-panel p-6 shadow-nav">
        <h2 className="text-[15px] font-bold text-titular">Datos personales</h2>
        <div className="mt-4">
          <PerfilDatosForm
            displayNameInicial={perfil.display_name ?? ''}
            provinciaInicial={perfil.origin_province_id}
            newsletterInicial={perfil.newsletter_opt_in}
            newsletterOptInAt={perfil.newsletter_opt_in_at}
            provincias={provincias ?? []}
          />
        </div>
      </section>

      {/* NOTIFICACIONES PUSH (0046) */}
      <section className="rounded-tarjeta border border-linea bg-panel p-6 shadow-nav">
        <h2 className="text-[15px] font-bold text-titular">Notificaciones push</h2>
        <div className="mt-3">
          <NotificacionesPushForm />
        </div>
      </section>

      {/* CONTRASEÑA */}
      <section className="rounded-tarjeta border border-linea bg-panel p-6 shadow-nav">
        <h2 className="text-[15px] font-bold text-titular">Contraseña</h2>
        <div className="mt-4">
          <ContrasenaForm tieneContrasenaInicial={Boolean(tieneContrasena)} />
        </div>
      </section>

      {/* 2FA */}
      <section className="rounded-tarjeta border border-linea bg-panel p-6 shadow-nav">
        <h2 className="text-[15px] font-bold text-titular">Verificación en dos pasos (2FA)</h2>
        <p className="mt-1 text-[13px] text-gris">
          Obligatorio si tienes un cargo orgánico vigente o rol de administración.
        </p>
        <div className="mt-4">
          <Seguridad2FA />
        </div>
      </section>

      {/* PRIVACIDAD / RGPD */}
      <section className="rounded-tarjeta border border-linea bg-panel p-6 shadow-nav">
        <h2 className="text-[15px] font-bold text-titular">Privacidad y tus datos</h2>
        <p className="mt-2 text-[13px] text-cuerpo">
          Consentimiento dado el{' '}
          {perfil.privacy_consent_at ? formatearFecha(perfil.privacy_consent_at) : '—'}.
        </p>
        <div className="mt-4">
          <ExportarBorrarCuenta />
        </div>
      </section>
    </div>
  );
}

function formatearFecha(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
