import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import { leerTokenCarnet } from '@/lib/carnet/token';
import { formatearNumeroSocio } from '@/lib/carnet/modelo';

export const metadata: Metadata = {
  title: 'Comprobación de carnet · Razón Común',
  // Un carnet indexado en Google es un desastre (D-C12). Fuera del sitemap
  // también, que se genera aparte.
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/**
 * Verificador público del carnet (D-C2, D-C4).
 *
 * PÚBLICO a propósito: tiene que poder escanearlo cualquiera, sin cuenta. Y
 * por eso enseña lo MÍNIMO — estado, número y antigüedad. **Nunca el nombre**:
 * quien escanea tiene la tarjeta delante y ahí está escrito, mientras que
 * publicarlo aquí convertiría cada QR en un endpoint para averiguar la
 * militancia de cualquiera a quien le fotografíes el carnet. La afiliación
 * política es dato de categoría especial (Art. 9 RGPD).
 *
 * Y la validez se calcula AHORA contra la base de datos, no se deduce de lo
 * impreso: es lo único que hace que el carnet de quien se dio de baja deje de
 * valer, porque la imagen seguirá en su móvil para siempre.
 */
export default async function VerificarCarnetPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // La firma se comprueba ANTES de tocar la base de datos: un token inventado
  // se descarta sin consultar nada, así que sondear esto no sirve de nada.
  const uid = leerTokenCarnet(decodeURIComponent(token));

  let valido = false;
  let numero: number | null = null;
  let nivel: string | null = null;
  let desde: string | null = null;

  if (uid) {
    const admin = createAdminClient();
    const { data } = await admin.rpc('carnet_por_uid', { p_uid: uid });
    const fila = Array.isArray(data) ? data[0] : null;
    if (fila) {
      valido = fila.valido === true;
      numero = fila.member_number ?? null;
      nivel = fila.nivel ?? null;
      desde = fila.socio_desde ?? null;
    }
  }

  const fechaAlta = (() => {
    if (!desde) return null;
    const d = new Date(desde);
    if (Number.isNaN(d.getTime())) return null;
    return `${MESES[d.getMonth()]} de ${d.getFullYear()}`;
  })();

  // `timeZone` explícito: el contenedor va en UTC y sin esto la comprobación
  // salía una hora antes de la que marcaba el móvil de quien escanea. En una
  // pantalla cuyo único cometido es decir "comprobado a tal hora", la hora
  // tiene que ser la de aquí.
  const comprobadoEl = new Intl.DateTimeFormat('es-ES', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Madrid',
  }).format(new Date());

  return (
    <main className="mx-auto flex min-h-[100svh] w-full max-w-[420px] flex-col items-center justify-center px-6 py-12 text-center">
      {/* Sin la nav del sitio, esta pantalla tiene que decir de quién es: quien
          escanea no ha navegado hasta aquí, ha apuntado la cámara a un carnet. */}
      <div className="mb-8 flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icono-rc.png" alt="" width={26} height={26} />
        <span className="text-[14px] font-extrabold tracking-tight text-titular">Razón Común</span>
      </div>

      <div
        className={`flex h-16 w-16 items-center justify-center rounded-full ${
          valido ? 'bg-teal' : 'bg-[#ED1156]'
        }`}
      >
        <span className="text-[30px] font-bold text-white" aria-hidden>
          {valido ? '✓' : '✕'}
        </span>
      </div>

      <h1
        className={`mt-4 text-[22px] font-extrabold ${valido ? 'text-[#12786A]' : 'text-[#B60D42]'}`}
      >
        {valido ? 'Carnet válido' : 'Carnet no válido'}
      </h1>

      {valido && nivel === 'verified' && (
        <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-[#12786A]">
          Socio verificado
        </p>
      )}

      {valido ? (
        <>
          <div className="mt-6 flex w-full justify-center gap-8 border-t border-linea pt-4 text-left">
            <div>
              <div className="text-[8.5px] font-bold uppercase tracking-[.14em] text-gris">
                Socio n.º
              </div>
              <div className="mt-0.5 text-[17px] font-extrabold tabular-nums text-titular">
                {numero != null ? formatearNumeroSocio(numero) : '—'}
              </div>
            </div>
            {fechaAlta && (
              <div>
                <div className="text-[8.5px] font-bold uppercase tracking-[.14em] text-gris">
                  Socio desde
                </div>
                <div className="mt-0.5 text-[13px] font-semibold text-titular">{fechaAlta}</div>
              </div>
            )}
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-gris">
            No se muestra el nombre: ya está en la tarjeta que tienes delante.
          </p>
        </>
      ) : (
        // MISMO mensaje para las tres causas (baja, impago y código falso), a
        // propósito: a quien escanea no le incumbe si el código es inventado o
        // si la persona se dio de baja el mes pasado.
        <p className="mt-5 text-[13px] leading-relaxed text-cuerpo">
          Este código no corresponde a una condición de socio vigente. Si crees que es un error,
          escribe a{' '}
          <a href="mailto:hola@razoncomun.com" className="font-semibold text-titular underline">
            hola@razoncomun.com
          </a>
          .
        </p>
      )}

      <p className="mt-10 text-[9px] text-[#A8AEBA]">
        Comprobado en razoncomun.com · {comprobadoEl}
      </p>
    </main>
  );
}
