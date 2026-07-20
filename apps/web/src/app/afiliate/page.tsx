import type { Metadata } from 'next';
import Link from 'next/link';
import { Contenedor } from '@/components/layout/Contenedor';
import { metadatosPagina } from '@/lib/seo';
import { getUsuarioYPerfil } from '@/lib/auth/niveles';
import { CUOTA_REFERENCIA_CENTS } from '@/lib/stripe/config';
import { TEXTO_CONSENTIMIENTO_AFILIACION, TEXTO_AVISO_MANDATO_SEPA, formatearCents } from '@/lib/afiliacion/consentimiento';
import { crearCheckoutSepa } from './actions';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Afíliate',
  descripcion:
    'Afíliate a Razón Común y convierte tu cuota en recursos, legitimidad y voz para una política basada en evidencia. Autosuficiencia total: el partido se sostiene con sus afiliados.',
  ruta: '/afiliate',
});

const ESCALERA = [
  {
    nivel: 'Registrado',
    activo: 'registered',
    descripcion: 'Cuenta creada. Puedes leer el programa, seguir el blog y participar en encuestas públicas.',
  },
  {
    nivel: 'Afiliado',
    activo: 'member',
    descripcion:
      'Tu cuota está activa. Votas en las propuestas de tu departamento (a partir de los 3 meses de antigüedad), propones y debates en el programa vivo, y auditas /cuentas.',
  },
  {
    nivel: 'Afiliado verificado',
    activo: 'verified',
    descripcion:
      'Verificas tu identidad una vez (Stripe Identity, desde tu perfil). Votas también cambios del manifiesto y eres elegible para listas y cargos internos.',
  },
] as const;

export default async function AfiliatePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; afiliacion?: string }>;
}) {
  const { error, afiliacion } = await searchParams;
  const { user, perfil, supabase } = await getUsuarioYPerfil();

  let yaAfiliado = false;
  if (user) {
    const { data: miembro } = await supabase
      .from('members')
      .select('status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();
    yaAfiliado = Boolean(miembro);
  }

  return (
    <Contenedor as="section" className="py-16">
      <div className="mx-auto w-full max-w-[880px] space-y-12">
        <header className="text-center">
          <span className="text-[13px] font-bold uppercase tracking-[.14em] text-titular">Afiliación</span>
          <h1 className="mt-2 text-[clamp(30px,5vw,44px)] font-extrabold">
            Convierte tu cuota en una política mejor
          </h1>
          <p className="mx-auto mt-3 max-w-[560px] text-[15px] text-cuerpo">
            Razón Común se sostiene con sus afiliados: sin dependencia externa, sin donantes opacos.
            Cada cuota se cobra por domiciliación bancaria SEPA — sin tarjetas que caducan, con una
            comisión mínima que deja más recursos al partido.
          </p>
        </header>

        {/* ESCALERA DE NIVELES */}
        <section className="grid gap-4 sm:grid-cols-3">
          {ESCALERA.map((peldaño, i) => {
            const esActual = perfil?.level === peldaño.activo;
            return (
              <div
                key={peldaño.nivel}
                className={`rounded-tarjeta border p-5 shadow-nav ${
                  esActual ? 'border-accion bg-panel' : 'border-linea bg-white'
                }`}
              >
                <span className="text-[11px] font-bold uppercase tracking-wide text-gris">
                  Nivel {i + 1}
                </span>
                <h3 className="mt-1 text-[17px] font-extrabold text-titular">
                  {peldaño.nivel}
                  {esActual && <span className="ml-2 text-[11px] font-bold text-accion">· tú</span>}
                </h3>
                <p className="mt-2 text-[13.5px] text-cuerpo">{peldaño.descripcion}</p>
              </div>
            );
          })}
        </section>

        {error === 'falta_consentimiento' && (
          <p className="rounded-boton border border-red-300 bg-red-50 px-4 py-3 text-[13.5px] text-red-700">
            Debes marcar la casilla de consentimiento para continuar.
          </p>
        )}
        {error === 'periodo_invalido' && (
          <p className="rounded-boton border border-red-300 bg-red-50 px-4 py-3 text-[13.5px] text-red-700">
            Elige una periodicidad de cuota antes de continuar.
          </p>
        )}
        {error === 'stripe_sin_url' && (
          <p className="rounded-boton border border-red-300 bg-red-50 px-4 py-3 text-[13.5px] text-red-700">
            No se pudo iniciar el pago con Stripe. Inténtalo de nuevo en un momento.
          </p>
        )}
        {afiliacion === 'cancelado' && (
          <p className="rounded-boton border border-linea bg-panel px-4 py-3 text-[13.5px] text-cuerpo">
            Has cancelado el proceso de alta. Puedes retomarlo cuando quieras.
          </p>
        )}

        {/* ALTA */}
        {yaAfiliado ? (
          <section className="rounded-tarjeta border border-linea bg-panel p-8 text-center shadow-nav">
            <h2 className="text-[20px] font-extrabold text-titular">Ya eres afiliado/a</h2>
            <p className="mt-2 text-[14px] text-cuerpo">
              Gestiona tu cuota, cambia de periodicidad o descarga tu certificado fiscal desde tu perfil.
            </p>
            <Link
              href="/perfil"
              className="mt-4 inline-block rounded-boton bg-accion px-5 py-2.5 text-[13.5px] font-bold text-white shadow-boton hover:-translate-y-0.5"
            >
              Ir a mi perfil
            </Link>
          </section>
        ) : (
          <section className="rounded-tarjeta border border-linea bg-panel p-8 shadow-nav">
            <h2 className="text-center text-[22px] font-extrabold text-titular">Elige tu cuota</h2>
            <form action={crearCheckoutSepa} className="mt-6 space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex cursor-pointer flex-col rounded-boton border border-linea bg-white p-5 has-[:checked]:border-accion has-[:checked]:ring-2 has-[:checked]:ring-accion/30">
                  <input type="radio" name="periodo" value="monthly" defaultChecked className="sr-only" />
                  <span className="text-[12px] font-bold uppercase tracking-wide text-gris">Mensual</span>
                  <span className="mt-1 text-[28px] font-extrabold text-titular">
                    {formatearCents(CUOTA_REFERENCIA_CENTS.monthly)}
                    <span className="text-[14px] font-semibold text-gris">/mes</span>
                  </span>
                </label>
                <label className="flex cursor-pointer flex-col rounded-boton border border-linea bg-white p-5 has-[:checked]:border-accion has-[:checked]:ring-2 has-[:checked]:ring-accion/30">
                  <input type="radio" name="periodo" value="annual" className="sr-only" />
                  <span className="text-[12px] font-bold uppercase tracking-wide text-gris">
                    Anual <span className="text-accion">· 2 meses gratis</span>
                  </span>
                  <span className="mt-1 text-[28px] font-extrabold text-titular">
                    {formatearCents(CUOTA_REFERENCIA_CENTS.annual)}
                    <span className="text-[14px] font-semibold text-gris">/año</span>
                  </span>
                </label>
              </div>

              <div className="rounded-boton border border-linea bg-white p-4 text-[12.5px] leading-relaxed text-cuerpo">
                <p className="font-bold text-titular">Sobre el cobro por domiciliación SEPA</p>
                <p className="mt-1">{TEXTO_AVISO_MANDATO_SEPA}</p>
              </div>

              <label className="flex items-start gap-3 text-[13px] leading-relaxed text-cuerpo">
                <input
                  type="checkbox"
                  name="consentimiento"
                  required
                  className="mt-0.5 h-4 w-4 rounded border-linea text-accion"
                />
                <span>{TEXTO_CONSENTIMIENTO_AFILIACION}</span>
              </label>

              {user ? (
                <button
                  type="submit"
                  className="w-full rounded-boton bg-accion px-5 py-3.5 text-[15px] font-bold text-white shadow-boton hover:-translate-y-0.5"
                >
                  Continuar con la domiciliación SEPA
                </button>
              ) : (
                <Link
                  href="/entrar?next=/afiliate"
                  className="block w-full rounded-boton bg-accion px-5 py-3.5 text-center text-[15px] font-bold text-white shadow-boton hover:-translate-y-0.5"
                >
                  Entra o regístrate para afiliarte
                </Link>
              )}

              <p className="text-center text-[12px] text-gris">
                Tu cuota desgrava en el IRPF (20%, hasta 600€/año). Recibirás certificado fiscal anual
                descargable desde tu perfil.
              </p>
            </form>
          </section>
        )}
      </div>
    </Contenedor>
  );
}
