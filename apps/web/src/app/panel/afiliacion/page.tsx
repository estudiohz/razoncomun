import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { metadatosPagina } from '@/lib/seo';
import { requireUsuario } from '@/lib/auth/niveles';
import { stripeCliente } from '@/lib/stripe/servidor';
import { listarCuotasDelAnio, type CuotaCobrada } from '@/lib/afiliacion/certificado';
import { formatearCents } from '@/lib/afiliacion/consentimiento';
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
    .select('status, billing_period, started_at, stripe_customer_id')
    .eq('user_id', user.id);

  const activa = miembros?.find((m) => m.status === 'active');
  const anyoActual = new Date().getFullYear();

  // Cuotas cobradas este año, leídas de Stripe (fuente de verdad, la misma que
  // el certificado). Si Stripe falla, la tabla se omite con un aviso: la página
  // de la cuota no puede caerse porque una API externa tarde.
  let cuotas: CuotaCobrada[] | null = null;
  if (activa?.stripe_customer_id) {
    try {
      cuotas = await listarCuotasDelAnio(await stripeCliente(), activa.stripe_customer_id, anyoActual);
    } catch (e) {
      console.error('[panel/afiliacion] no se pudieron leer las cuotas de Stripe', e);
    }
  }

  // `?alta=ok` lo pone el alta DESPUÉS de crear la suscripción en Stripe. Si
  // está y todavía no hay fila en `members`, no es que no seas socio: es que el
  // webhook aún no ha escrito (tardó 19 segundos en la prueba del 04/09/2026).
  const { alta } = await searchParams;
  const reciénDadoDeAlta = alta === 'ok' && !activa;
  // Y cuando la fila ya está, se celebra: sin esto la persona aterrizaba en la
  // ficha de cuota a secas y no sabía si el alta había terminado (Sergio,
  // 14/10/2026, primera alta real en producción).
  const altaConfirmada = alta === 'ok' && !!activa;

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
          {altaConfirmada && (
            <section
              role="status"
              className="rounded-tarjeta border border-teal/40 bg-teal/[.06] p-6"
            >
              <h2 className="text-[17px] font-extrabold text-titular">¡Ya eres socio de Razón Común!</h2>
              <p className="mt-2 text-[13.5px] text-cuerpo">
                Tu alta se ha completado correctamente y tu primera cuota está cobrada. Recibirás el
                recibo por correo. Gracias por sostener una política basada en datos.
              </p>
              <Link
                href="/panel/carnet"
                className="mt-4 inline-block rounded-boton bg-accion px-5 py-3 text-[14px] font-bold text-white no-underline shadow-boton"
              >
                Ver mi carnet de socio
              </Link>
            </section>
          )}

          <section className="rounded-tarjeta border border-linea bg-panel p-6 shadow-nav">
            <h2 className="text-[15px] font-bold text-titular">Tu cuota</h2>
            <p className="mt-2 text-[13.5px] text-cuerpo">
              Cuota {activa.billing_period === 'annual' ? 'anual' : 'mensual'}, socio/a desde el{' '}
              {formatearFecha(activa.started_at)}. Gestiona el método de pago o date de baja desde
              el Customer Portal de Stripe (enlace en el correo de recibo).
            </p>
          </section>

          <section className="rounded-tarjeta border border-linea bg-panel p-6 shadow-nav">
            <h2 className="text-[15px] font-bold text-titular">Cuotas pagadas en {anyoActual}</h2>
            {cuotas === null ? (
              <p className="mt-2 text-[13.5px] text-cuerpo">
                Ahora mismo no podemos consultar tus pagos. Vuelve a intentarlo en unos minutos.
              </p>
            ) : cuotas.length === 0 ? (
              <p className="mt-2 text-[13.5px] text-cuerpo">
                Todavía no hay cuotas cobradas este año. Una domiciliación SEPA puede tardar unos días
                en aparecer como pagada.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[420px] text-left text-[13.5px] text-cuerpo">
                  <thead>
                    <tr className="border-b border-linea text-[12px] uppercase tracking-wide text-gris">
                      <th scope="col" className="py-2 pr-4 font-bold">Fecha</th>
                      <th scope="col" className="py-2 pr-4 font-bold">Recibo</th>
                      <th scope="col" className="py-2 text-right font-bold">Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cuotas.map((c) => (
                      <tr key={c.id} className="border-b border-linea/60">
                        <td className="py-2.5 pr-4">{formatearFecha(c.fecha.toISOString())}</td>
                        <td className="py-2.5 pr-4">
                          {c.urlRecibo ? (
                            <a
                              href={c.urlRecibo}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-titular underline underline-offset-2"
                            >
                              {c.numero ?? 'Ver recibo'}
                            </a>
                          ) : (
                            (c.numero ?? '—')
                          )}
                        </td>
                        <td className="py-2.5 text-right font-semibold text-titular">
                          {formatearCents(c.importeCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={2} className="pt-3 pr-4 font-bold text-titular">
                        Total {anyoActual} ({cuotas.length} {cuotas.length === 1 ? 'cuota' : 'cuotas'})
                      </td>
                      <td className="pt-3 text-right font-extrabold text-titular">
                        {formatearCents(cuotas.reduce((s, c) => s + c.importeCents, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
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
