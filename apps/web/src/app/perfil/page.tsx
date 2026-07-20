import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Contenedor } from '@/components/layout/Contenedor';
import { metadatosPagina } from '@/lib/seo';
import { requireUsuario } from '@/lib/auth/niveles';
import { cerrarSesion } from './actions';
import { PerfilDatosForm } from './PerfilDatosForm';
import { ContrasenaForm } from './ContrasenaForm';
import { Seguridad2FA } from './Seguridad2FA';
import { ExportarBorrarCuenta } from './ExportarBorrarCuenta';
import { VerificarIdentidad } from './VerificarIdentidad';
import { MisVotos } from '@/components/participacion/MisVotos';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Mi perfil',
  descripcion: 'Tu área personal en Razón Común.',
  ruta: '/perfil',
  noindex: true,
});

const NOMBRE_NIVEL: Record<string, string> = {
  registered: 'Registrado',
  member: 'Afiliado',
  verified: 'Afiliado verificado',
};

export default async function PerfilPage() {
  const { user, perfil, supabase } = await requireUsuario('/perfil');

  // El trigger on_auth_user_created (rc-02-datos) garantiza esta fila en
  // cuanto existe el usuario; si por lo que sea faltara, no seguimos.
  if (!perfil) redirect('/entrar');

  const [{ data: provincias }, { data: cargos }, { data: miembros }, { data: tieneContrasena }] =
    await Promise.all([
      supabase.from('territories').select('id, name').eq('type', 'province').order('name'),
      supabase.from('positions').select('role, scope, started_at').eq('user_id', user.id).is('ended_at', null),
      supabase.from('members').select('status, billing_period, started_at').eq('user_id', user.id),
      // has_password() (migración 0025, rc-02): true si el usuario ya tiene
      // contraseña en GoTrue, false si entró siempre por enlace mágico.
      supabase.rpc('has_password'),
    ]);

  const afiliacionActiva = miembros?.find((m) => m.status === 'active');

  return (
    <Contenedor as="section" className="py-16">
      <div className="mx-auto w-full max-w-[720px] space-y-8">
        <header>
          <span className="text-[13px] font-bold uppercase tracking-[.14em] text-titular">
            Tu cuenta
          </span>
          <h1 className="mt-2 text-[clamp(28px,4vw,36px)] font-extrabold">Mi perfil</h1>
          <p className="mt-1 text-[14px] text-gris">{user.email}</p>
        </header>

        {/* NIVEL */}
        <section className="rounded-tarjeta border border-linea bg-panel p-6 shadow-nav">
          <h2 className="text-[16px] font-bold text-titular">Tu nivel</h2>
          <p className="mt-2 text-[22px] font-extrabold">{NOMBRE_NIVEL[perfil.level] ?? perfil.level}</p>
          {cargos && cargos.length > 0 && (
            <p className="mt-1 text-[13px] text-cuerpo">
              Cargo vigente: {cargos.map((c) => c.role).join(', ')}
            </p>
          )}
          <div className="mt-4 space-y-3 text-[13.5px] text-cuerpo">
            {perfil.level === 'registered' && (
              <p>
                Hazte afiliado para votar en las propuestas de departamento.{' '}
                <a href="/afiliate" className="font-semibold text-titular underline">
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
              <p>Tienes el nivel máximo. Verificado el {formatearFecha(perfil.identity_verified_at)}.</p>
            )}
          </div>
        </section>

        {/* AFILIACIÓN / CERTIFICADO FISCAL (rc-07) */}
        {afiliacionActiva && (
          <section className="rounded-tarjeta border border-linea bg-panel p-6 shadow-nav">
            <h2 className="text-[16px] font-bold text-titular">Tu afiliación</h2>
            <p className="mt-2 text-[13.5px] text-cuerpo">
              Cuota {afiliacionActiva.billing_period === 'annual' ? 'anual' : 'mensual'}, afiliado/a
              desde el {formatearFecha(afiliacionActiva.started_at)}. Gestiona el método de pago o date
              de baja desde el Customer Portal de Stripe (enlace en el próximo correo de recibo).
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href={`/api/afiliacion/certificado?year=${new Date().getFullYear() - 1}`}
                className="rounded-boton bg-accion px-4 py-2.5 text-[13px] font-bold text-white shadow-boton hover:-translate-y-0.5"
              >
                Descargar certificado fiscal {new Date().getFullYear() - 1}
              </a>
              <a
                href={`/api/afiliacion/certificado?year=${new Date().getFullYear()}`}
                className="rounded-boton border border-linea bg-white px-4 py-2.5 text-[13px] font-bold text-titular hover:border-titular"
              >
                Certificado del año en curso
              </a>
            </div>
            <p className="mt-3 text-[12px] text-gris">
              Tu cuota desgrava el 20% en el IRPF (límite 600€/año, LO 8/2007). Si no hay cuotas
              cobradas en el año elegido, la descarga devolverá un aviso en vez del PDF.
            </p>
          </section>
        )}

        {/* DATOS */}
        <section className="rounded-tarjeta border border-linea bg-panel p-6 shadow-nav">
          <h2 className="text-[16px] font-bold text-titular">Datos personales</h2>
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

        {/* CONTRASEÑA (aviso de rc-03: quien entra por enlace mágico nunca
            fija una y no tenía dónde hacerlo) */}
        <section className="rounded-tarjeta border border-linea bg-panel p-6 shadow-nav">
          <h2 className="text-[16px] font-bold text-titular">Contraseña</h2>
          <div className="mt-4">
            <ContrasenaForm tieneContrasenaInicial={Boolean(tieneContrasena)} />
          </div>
        </section>

        {/* 2FA */}
        <section className="rounded-tarjeta border border-linea bg-panel p-6 shadow-nav">
          <h2 className="text-[16px] font-bold text-titular">Verificación en dos pasos (2FA)</h2>
          <p className="mt-1 text-[13px] text-gris">
            Obligatorio si tienes un cargo orgánico vigente o rol de administración.
          </p>
          <div className="mt-4">
            <Seguridad2FA />
          </div>
        </section>

        {/* PRIVACIDAD / RGPD */}
        <section className="rounded-tarjeta border border-linea bg-panel p-6 shadow-nav">
          <h2 className="text-[16px] font-bold text-titular">Privacidad y tus datos</h2>
          <p className="mt-2 text-[13px] text-cuerpo">
            Consentimiento dado el{' '}
            {perfil.privacy_consent_at ? formatearFecha(perfil.privacy_consent_at) : '—'}.
          </p>
          <div className="mt-4">
            <ExportarBorrarCuenta />
          </div>
        </section>

        {/* PARTICIPACIÓN: verificación del propio voto (D-001, voto público nominal) */}
        <section className="rounded-tarjeta border border-linea bg-panel p-6 shadow-nav">
          <h2 className="text-[16px] font-bold text-titular">Mis votos</h2>
          <p className="mt-1 text-[13px] text-gris">
            Verifica que lo que emitiste quedó registrado tal cual. El voto es público con tu
            nombre (D-001): esta misma información es visible para cualquiera en la página de la
            votación.
          </p>
          <div className="mt-4">
            <MisVotos supabase={supabase} userId={user.id} />
          </div>
        </section>

        <form action={cerrarSesion}>
          <button type="submit" className="text-[13.5px] font-semibold text-cuerpo underline">
            Cerrar sesión
          </button>
        </form>
      </div>
    </Contenedor>
  );
}

function formatearFecha(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}
