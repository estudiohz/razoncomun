import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { metadatosPagina } from '@/lib/seo';
import { requireUsuario } from '@/lib/auth/niveles';
import { ConfirmandoAlta } from './ConfirmandoAlta';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Cuota de socio',
  descripcion: 'Tu alta como socio de Razón Común: cuota y certificados fiscales.',
  ruta: '/panel/afiliacion',
  noindex: true,
});

/**
 * Cuota de socio dentro del panel (U2). Una sola ruta para los dos casos, en vez
 * de esconderla a quien no es socio (D-U3): si no lo eres, es donde te das
 * de alta; si lo eres, es donde gestionas la cuota y descargas certificados.
 *
 * El alta real sigue viviendo en `/unete` (flujo público con Stripe/SEPA,
 * propiedad de rc-07): aquí no se duplica, se enlaza.
 */
export default async function PanelAfiliacionPage({
  searchParams,
}: {
  searchParams: Promise<{ alta?: string }>;
}) {
  const { user, perfil, supabase } = await requireUsuario('/panel/afiliacion');
  if (!perfil) redirect('/entrar');

  const { data: miembros } = await supabase
    .from('members')
    .select('status, billing_period, started_at')
    .eq('user_id', user.id);

  const activa = miembros?.find((m) => m.status === 'active');
  const anyoActual = new Date().getFullYear();

  // `?alta=ok` lo pone el alta DESPUÉS de crear la suscripción en Stripe. Si
  // está y todavía no hay fila en `members`, no es que no seas socio: es que el
  // webhook aún no ha escrito (tardó 19 segundos en la prueba del 04/09/2026).
  const { alta } = await searchParams;
  const reciénDadoDeAlta = alta === 'ok' && !activa;

  return (
    <div className="mx-auto w-full max-w-[760px] space-y-6">
      <header>
        <h1 className="text-[clamp(24px,3.4vw,32px)] font-extrabold leading-tight">Cuota de socio</h1>
        <p className="mt-1 text-[14px] text-gris">
          Razón Común se financia solo con las cuotas de sus socios.
        </p>
      </header>

      {reciénDadoDeAlta ? (
        <ConfirmandoAlta />
      ) : activa ? (
        <>
          <section className="rounded-tarjeta border border-linea bg-panel p-6 shadow-nav">
            <h2 className="text-[15px] font-bold text-titular">Tu cuota</h2>
            <p className="mt-2 text-[13.5px] text-cuerpo">
              Cuota {activa.billing_period === 'annual' ? 'anual' : 'mensual'}, socio/a desde el{' '}
              {formatearFecha(activa.started_at)}. Gestiona el método de pago o date de baja desde
              el Customer Portal de Stripe (enlace en el correo de recibo).
            </p>
          </section>

          <section className="rounded-tarjeta border border-linea bg-panel p-6 shadow-nav">
            <h2 className="text-[15px] font-bold text-titular">Certificados fiscales</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href={`/api/afiliacion/certificado?year=${anyoActual - 1}`}
                className="rounded-boton bg-accion px-4 py-2.5 text-[13px] font-bold text-white no-underline shadow-boton"
              >
                Descargar certificado {anyoActual - 1}
              </a>
              <a
                href={`/api/afiliacion/certificado?year=${anyoActual}`}
                className="rounded-boton border border-linea bg-white px-4 py-2.5 text-[13px] font-bold text-titular no-underline hover:border-titular"
              >
                Certificado del año en curso
              </a>
            </div>
            <p className="mt-3 text-[12px] text-gris">
              Tu cuota desgrava el 20% en el IRPF (límite 600€/año, LO 8/2007). Si no hay cuotas
              cobradas en el año elegido, la descarga devolverá un aviso en vez del PDF.
            </p>
          </section>
        </>
      ) : (
        <section className="rounded-tarjeta border border-teal/40 bg-teal/[.06] p-6">
          <h2 className="text-[15px] font-bold text-titular">Todavía no eres socio</h2>
          <p className="mt-2 text-[13.5px] text-cuerpo">
            Al hacerte socio puedes votar las propuestas de departamento y sostienes el partido. La
            cuota desgrava el 20% en el IRPF (límite 600€/año, LO 8/2007).
          </p>
          <Link
            href="/unete"
            className="mt-4 inline-block rounded-boton bg-accion px-5 py-3 text-[14px] font-bold text-white no-underline shadow-boton"
          >
            Hacerme socio
          </Link>
        </section>
      )}

      {perfil.level === 'member' && (
        <section className="rounded-tarjeta border border-linea bg-panel p-6 shadow-nav">
          <h2 className="text-[15px] font-bold text-titular">Siguiente paso: verificarte</h2>
          <p className="mt-2 text-[13.5px] text-cuerpo">
            Con la identidad verificada podrás votar cambios del manifiesto y ser elegible para
            listas y cargos internos.
          </p>
          <Link
            href="/panel/perfil#verificacion"
            className="mt-3 inline-block rounded-boton border border-linea bg-white px-4 py-2.5 text-[13px] font-bold text-titular no-underline hover:border-titular"
          >
            Verificar mi identidad
          </Link>
        </section>
      )}
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
