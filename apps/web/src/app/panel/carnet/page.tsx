import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { metadatosPagina } from '@/lib/seo';
import { requireUsuario } from '@/lib/auth/niveles';
import { cargarCarnet } from '@/lib/carnet/modelo';
import { enlaceGoogleWallet } from '@/lib/carnet/google';
import { carnetOperativo } from '@/lib/carnet/token';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Mi carnet de socio',
  descripcion: 'Tu carnet de socio de Razón Común: descárgalo o añádelo a la wallet.',
  ruta: '/panel/carnet',
  noindex: true,
});

/**
 * El carnet de socio dentro del panel (ola C1).
 *
 * Esta página existe para que el carnet NO viaje por correo (D-C6). El correo
 * de bienvenida trae un enlace aquí, no el fichero: un PDF adjunto o un enlace
 * de Google Wallet —que no pide sesión— es un carnet reenviable por WhatsApp
 * sin ningún control.
 *
 * Una sola ruta para los dos casos, como `/panel/afiliacion`: si todavía no
 * eres socio, aquí es donde se te explica qué te falta.
 */
export default async function PanelCarnetPage() {
  const { user, perfil, supabase } = await requireUsuario('/panel/carnet');
  if (!perfil) redirect('/entrar');

  // Sin CARNET_SECRET no se puede firmar ningún QR. Mejor decirlo que
  // devolver un 500 que no explica nada.
  if (!carnetOperativo()) {
    return (
      <div className="mx-auto w-full max-w-[760px] space-y-6">
        <header>
          <h1 className="text-[clamp(24px,3.4vw,32px)] font-extrabold leading-tight">Mi carnet</h1>
        </header>
        <section className="rounded-tarjeta border border-linea bg-white p-6">
          <h2 className="text-[15px] font-bold text-titular">El carnet aún no está activo</h2>
          <p className="mt-2 text-[13.5px] text-cuerpo">
            Estamos terminando de configurarlo. Tu número de socio ya está asignado y te espera
            aquí en cuanto lo encendamos.
          </p>
        </section>
      </div>
    );
  }

  const resultado = await cargarCarnet(supabase, user.id);

  if ('motivo' in resultado) {
    return (
      <div className="mx-auto w-full max-w-[760px] space-y-6">
        <header>
          <h1 className="text-[clamp(24px,3.4vw,32px)] font-extrabold leading-tight">Mi carnet</h1>
        </header>

        <section className="rounded-tarjeta border border-teal/40 bg-teal/[.06] p-6">
          {resultado.motivo === 'no_es_socio' && (
            <>
              <h2 className="text-[15px] font-bold text-titular">Todavía no tienes carnet</h2>
              <p className="mt-2 text-[13.5px] text-cuerpo">
                El carnet lleva tu número de socio, y ese número se asigna con la primera cuota. En
                cuanto te hagas socio lo tendrás aquí, listo para llevarlo en el móvil.
              </p>
              <Link
                href="/unete"
                className="mt-4 inline-block rounded-boton bg-accion px-5 py-3 text-[14px] font-bold text-white no-underline shadow-boton"
              >
                Hacerme socio
              </Link>
            </>
          )}

          {resultado.motivo === 'sin_numero' && (
            <>
              <h2 className="text-[15px] font-bold text-titular">Tu carnet se está preparando</h2>
              <p className="mt-2 text-[13.5px] text-cuerpo">
                Tu cuota consta como activa pero aún no tienes número de socio asignado. Suele ser
                cuestión de minutos. Si mañana sigue así, escríbenos.
              </p>
            </>
          )}

          {resultado.motivo === 'dado_de_baja' && (
            <>
              <h2 className="text-[15px] font-bold text-titular">Esta cuenta está dada de baja</h2>
              <p className="mt-2 text-[13.5px] text-cuerpo">No hay carnet asociado.</p>
            </>
          )}
        </section>
      </div>
    );
  }

  const { carnet } = resultado;
  const { data: fila } = await supabase
    .from('profiles')
    .select('carnet_uid')
    .eq('id', user.id)
    .single();

  const urlGoogle = fila?.carnet_uid
    ? enlaceGoogleWallet(fila.carnet_uid as string, carnet)
    : null;

  return (
    <div className="mx-auto w-full max-w-[760px] space-y-6">
      <header>
        <h1 className="text-[clamp(24px,3.4vw,32px)] font-extrabold leading-tight">Mi carnet</h1>
        <p className="mt-1 text-[14px] text-gris">
          Socio n.º <strong className="text-titular">{carnet.numeroSocio}</strong>
          {carnet.socioDesde ? ` · desde ${carnet.socioDesde.toLowerCase()}` : ''}
          {carnet.verificado ? ' · verificado' : ''}
        </p>
      </header>

      <section className="rounded-tarjeta border border-linea bg-white p-6">
        <h2 className="text-[15px] font-bold text-titular">Llévalo en el móvil</h2>
        <p className="mt-2 text-[13.5px] text-cuerpo">
          Acredita que eres socio. Al escanear el código, quien lo mire ve si tu carnet está vigente
          en ese momento — no lo que ponga impreso.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          {urlGoogle && (
            <a
              href={urlGoogle}
              className="rounded-boton bg-titular px-5 py-3 text-[14px] font-bold text-white no-underline shadow-boton"
            >
              Añadir a Google Wallet
            </a>
          )}
          <a
            href="/api/carnet/pdf"
            className="rounded-boton border border-linea bg-white px-5 py-3 text-[14px] font-bold text-titular no-underline hover:border-titular"
          >
            Descargar en PDF
          </a>
        </div>

        {!urlGoogle && (
          <p className="mt-4 rounded-boton bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
            El botón de Google Wallet aparecerá cuando esté aprobada la cuenta de emisor. Mientras
            tanto, el PDF hace el mismo papel: guárdalo en el móvil.
          </p>
        )}
      </section>

      <section className="rounded-tarjeta border border-linea bg-white p-6">
        <h2 className="text-[15px] font-bold text-titular">Si pierdes el móvil</h2>
        <p className="mt-2 text-[13.5px] text-cuerpo">
          Escríbenos y te emitimos un carnet nuevo. El anterior deja de dar válido al escanearlo, en
          el momento — aunque siga guardado en el teléfono que perdiste.
        </p>
      </section>

      <p className="text-[12.5px] text-gris">
        El carnet acredita tu condición de socio, no tu identidad. No sustituye a ningún documento
        oficial.
      </p>
    </div>
  );
}
