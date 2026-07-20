import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Contenedor } from '@/components/layout/Contenedor';
import { metadatosPagina } from '@/lib/seo';
import { requireUsuario } from '@/lib/auth/niveles';
import { actualizarPerfil, cerrarSesion } from './actions';
import { Seguridad2FA } from './Seguridad2FA';
import { ExportarBorrarCuenta } from './ExportarBorrarCuenta';
import { VerificarIdentidad } from './VerificarIdentidad';

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

  const [{ data: provincias }, { data: cargos }, { data: miembros }] = await Promise.all([
    supabase.from('territories').select('id, name').eq('type', 'province').order('name'),
    supabase.from('positions').select('role, scope, started_at').eq('user_id', user.id).is('ended_at', null),
    supabase.from('members').select('status, billing_period, started_at').eq('user_id', user.id),
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

        {/* DATOS */}
        <section className="rounded-tarjeta border border-linea bg-panel p-6 shadow-nav">
          <h2 className="text-[16px] font-bold text-titular">Datos personales</h2>
          <form action={actualizarPerfil} className="mt-4 space-y-4">
            <div>
              <label htmlFor="display_name" className="mb-1.5 block text-[13.5px] font-semibold">
                Nombre a mostrar
              </label>
              <input
                id="display_name"
                name="display_name"
                defaultValue={perfil.display_name ?? ''}
                className="w-full rounded-boton border border-linea bg-white px-4 py-2.5 text-[15px]"
              />
            </div>
            <div>
              <label htmlFor="origin_province_id" className="mb-1.5 block text-[13.5px] font-semibold">
                Provincia de origen <span className="font-normal text-gris">(opcional, autodeclarado)</span>
              </label>
              <select
                id="origin_province_id"
                name="origin_province_id"
                defaultValue={perfil.origin_province_id ?? ''}
                className="w-full rounded-boton border border-linea bg-white px-4 py-2.5 text-[15px]"
              >
                <option value="">Sin especificar</option>
                {provincias?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2.5 text-[13.5px] text-cuerpo">
              <input
                type="checkbox"
                name="newsletter_opt_in"
                defaultChecked={perfil.newsletter_opt_in}
                className="h-4 w-4 rounded border-linea text-accion"
              />
              Recibir la newsletter
              {perfil.newsletter_opt_in_at && (
                <span className="text-[12px] text-gris">
                  (opt-in del {formatearFecha(perfil.newsletter_opt_in_at)})
                </span>
              )}
            </label>
            <button
              type="submit"
              className="rounded-boton bg-accion px-5 py-2.5 text-[13.5px] font-bold text-white shadow-boton hover:-translate-y-0.5"
            >
              Guardar cambios
            </button>
          </form>
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
