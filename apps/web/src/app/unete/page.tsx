import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Contenedor } from '@/components/layout/Contenedor';
import { metadatosPagina } from '@/lib/seo';
import { getUsuarioYPerfil } from '@/lib/auth/niveles';
import {
  CUOTA_REFERENCIA_CENTS,
  planVerificadoDisponible,
  type PlanCuota,
} from '@/lib/stripe/config';
import { formatearCents } from '@/lib/afiliacion/consentimiento';
import { AltaSepa } from './AltaSepa';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Únete',
  descripcion:
    'Hazte socio de Razón Común y convierte tu cuota en recursos, legitimidad y voz para una política basada en evidencia. Autosuficiencia total: el partido se sostiene con sus socios.',
  ruta: '/unete',
});

/**
 * Escalera de niveles. Cada peldaño lleva su color del espectro del aro
 * (teal → morado → magenta): la página era un muro blanco y azul y la
 * progresión no se leía de un vistazo (Sergio, 10/08/2026). Las clases van
 * literales —nada de plantillas `bg-${x}`— porque Tailwind solo compila lo
 * que puede ver escrito.
 *
 * Nomenclatura: "socio", nunca la palabra vieja (Sergio, 10/08/2026,
 * reafirmado el 04/09/2026 y aplicado ya a toda la web). El valor de
 * `activo` sigue siendo el del ENUM de la BD (`member`, `verified`), que no
 * se toca — es solo la etiqueta visible la que cambia.
 *
 * `cta`: el botón de cada peldaño. `#alta` baja a la caja de alta que está al
 * final de esta misma página (scroll suave: `scroll-behavior:smooth` global
 * en globals.css); el primer peldaño sale de la página, al registro.
 */
const ESCALERA = [
  {
    nivel: 'Registrado',
    activo: 'registered',
    descripcion:
      'Cuenta creada. Puedes leer el programa, seguir el blog y participar en encuestas públicas.',
    punto: 'Gratis, para siempre',
    cta: { texto: 'Crea tu cuenta gratis', href: '/registro' },
    aro: 'bg-teal',
    borde: 'border-t-teal',
    tinte: 'bg-teal/10',
    texto: 'text-teal-texto',
    // `bg-accion` (#157F70) y NO `bg-teal` (#16B8A0): el teal decorativo con
    // texto blanco encima da 2,5:1 — suspende WCAG AA. `accion` es el teal de
    // la misma familia ya oscurecido para llevar texto (4,88:1), y es el que
    // usa el resto de botones sólidos de la web. El aro numerado y la píldora
    // sí conservan el teal claro: ahí no hay texto blanco encima.
    boton: 'bg-accion hover:brightness-95',
  },
  {
    nivel: 'Socio',
    activo: 'member',
    descripcion:
      'Tu cuota está activa. Votas en las propuestas de tu departamento (a partir de los 3 meses de antigüedad), propones y debates en el programa vivo, y auditas /cuentas.',
    punto: `Desde ${formatearCents(CUOTA_REFERENCIA_CENTS.socio.monthly)}/mes`,
    cta: { texto: 'Hazte socio', href: '/unete?plan=socio#alta' },
    aro: 'bg-morado',
    borde: 'border-t-morado',
    tinte: 'bg-morado/10',
    texto: 'text-morado',
    boton: 'bg-morado hover:brightness-95',
  },
  {
    nivel: 'Socio verificado',
    activo: 'verified',
    descripcion:
      'Verificas tu identidad una vez (Stripe Identity, desde tu perfil). Votas también cambios del manifiesto y eres elegible para listas y cargos internos.',
    punto: `Desde ${formatearCents(CUOTA_REFERENCIA_CENTS.verificado.monthly)}/mes`,
    cta: { texto: 'Hazte socio verificado', href: '/unete?plan=verificado#alta' },
    aro: 'bg-magenta',
    borde: 'border-t-magenta',
    tinte: 'bg-magenta/10',
    texto: 'text-magenta',
    boton: 'bg-magenta hover:brightness-95',
  },
] as const;

/** A qué va la cuota. Cada tarjeta con su color, para romper el gris. */
const DESTINO_CUOTA = [
  {
    color: 'bg-naranja',
    titulo: 'Difusión',
    texto: 'Llegar a quien no nos conoce todavía: la prioridad número uno del partido.',
    icono: (
      <path
        d="M3 11v2a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1Zm12.5 1a4.5 4.5 0 0 0-2-3.7v7.4a4.5 4.5 0 0 0 2-3.7Z"
        fill="#fff"
      />
    ),
  },
  {
    color: 'bg-cian',
    titulo: 'Herramientas',
    texto: 'Servidores, datos y la IA que audita, simula y traduce el BOE a lenguaje claro.',
    icono: (
      <path
        d="M4 17h16M4 12h10M4 7h7"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
    ),
  },
  {
    color: 'bg-morado',
    titulo: 'Independencia',
    texto: 'Sin donantes opacos ni deudas con nadie. Solo respondemos ante los socios.',
    icono: <path d="M12 3 4 6.5v5c0 4.4 3.4 8.3 8 9.5 4.6-1.2 8-5.1 8-9.5v-5L12 3Z" fill="#fff" />,
  },
  {
    color: 'bg-teal',
    titulo: 'Cuentas abiertas',
    texto: 'Cada euro que entra y sale se publica en /cuentas. Puedes auditarlo tú.',
    icono: (
      <path
        d="M3 12h4l3-8 4 16 3-8h4"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    ),
  },
] as const;

export default async function UnetePage({
  searchParams,
}: {
  // Next 15: `searchParams` llega como Promise en server components.
  searchParams: Promise<{ plan?: string }>;
}) {
  const { user, perfil, supabase } = await getUsuarioYPerfil();

  // Tramo preseleccionado por los botones de la escalera (`?plan=verificado`).
  // Cualquier otro valor cae en 'socio' — nunca se confía en la query string.
  const verificadoDisponible = planVerificadoDisponible();
  const { plan: planQuery } = await searchParams;
  const planInicial: PlanCuota =
    planQuery === 'verificado' && verificadoDisponible ? 'verificado' : 'socio';

  let yaSocio = false;
  if (user) {
    const { data: miembro } = await supabase
      .from('members')
      .select('status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();
    yaSocio = Boolean(miembro);
  }

  return (
    <Contenedor as="section" className="py-10 min-[720px]:py-14">
      <div className="mx-auto w-full max-w-[980px] space-y-10 min-[720px]:space-y-14">
        {/* CABECERA — celda con el espectro completo del aro. Misma pieza que
            usa el bento de la home (`bg-hero-celda`), que es la que da a la
            marca su registro cromático; el header en blanco sobre fondo
            claro dejaba la página entera monocroma. */}
        <header className="relative overflow-hidden rounded-celda bg-hero-celda px-6 py-12 text-center text-white shadow-tarjeta min-[720px]:px-12 min-[720px]:py-16">
          {/* Aros decorativos: puro adorno, detrás del texto y sin peso
              semántico (aria-hidden). Recortados por el overflow-hidden. */}
          <svg
            className="pointer-events-none absolute -right-16 -top-20 opacity-20"
            width="280"
            height="280"
            viewBox="0 0 100 100"
            fill="none"
            aria-hidden
          >
            <circle cx="50" cy="50" r="46" stroke="#fff" strokeWidth="3" />
            <circle cx="50" cy="50" r="32" stroke="#fff" strokeWidth="3" />
            <circle cx="50" cy="50" r="18" stroke="#fff" strokeWidth="3" />
          </svg>
          <svg
            className="pointer-events-none absolute -bottom-24 -left-20 opacity-15"
            width="240"
            height="240"
            viewBox="0 0 100 100"
            fill="none"
            aria-hidden
          >
            <circle cx="50" cy="50" r="46" stroke="#fff" strokeWidth="3" />
            <circle cx="50" cy="50" r="28" stroke="#fff" strokeWidth="3" />
          </svg>

          <div className="relative z-[2]">
            <span className="inline-block rounded-full border border-white/40 bg-white/15 px-4 py-1.5 text-[12px] font-bold uppercase tracking-[.14em]">
              Hazte socio
            </span>
            <h1 className="mx-auto mt-4 max-w-[16ch] text-[clamp(30px,5vw,46px)] font-extrabold leading-[1.12] !text-white">
              Convierte tu cuota en una política mejor
            </h1>
            <p className="mx-auto mt-4 max-w-[58ch] text-[15.5px] leading-relaxed text-white/90">
              Razón Común se sostiene con sus socios: sin dependencia externa, sin donantes
              opacos. Cada cuota se cobra por domiciliación bancaria SEPA — sin tarjetas que
              caducan, con una comisión mínima que deja más recursos al partido.
            </p>

            {/* Tres datos duros en píldoras: lo que antes estaba enterrado en
                un párrafo de letra pequeña al final del formulario. */}
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {[
                `Desde ${formatearCents(CUOTA_REFERENCIA_CENTS.socio.monthly)} al mes`,
                'Desgrava el 20% en el IRPF',
                'Te das de baja cuando quieras',
              ].map((dato) => (
                <span
                  key={dato}
                  className="rounded-full border border-white/30 bg-white/10 px-4 py-2 text-[13px] font-semibold backdrop-blur-sm"
                >
                  {dato}
                </span>
              ))}
            </div>
          </div>
        </header>

        {/* ESCALERA DE NIVELES */}
        <section>
          {/* Banda con foto encima de los tres niveles (Sergio, 10/08/2026):
              rompe la sucesión de cajas y pone caras a lo que se está
              pidiendo. El título va DENTRO como texto real sobre un velo
              oscuro — no incrustado en la imagen — para que siga siendo un
              h2 legible por lectores de pantalla y buscadores. */}
          <div className="relative overflow-hidden rounded-celda shadow-tarjeta">
            <Image
              src="/fotos/jovenes-diversos.jpg"
              alt="Un grupo de personas jóvenes caminando juntas y riendo por la ciudad"
              width={1920}
              height={1280}
              sizes="(max-width: 980px) 100vw, 980px"
              className="h-[220px] w-full object-cover object-center min-[720px]:h-[300px]"
            />
            {/* Velo: sin él el texto blanco se pierde sobre el cielo claro de
                la foto. Va de transparente arriba a azul de marca abajo. */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(180deg,rgba(11,32,72,.15) 0%,rgba(11,32,72,.55) 55%,rgba(11,32,72,.88) 100%)',
              }}
              aria-hidden
            />
            <div className="absolute inset-x-0 bottom-0 p-6 text-center min-[720px]:p-9">
              <h2 className="text-[clamp(21px,3vw,29px)] font-extrabold !text-white">
                Tres peldaños, cada uno con más voz
              </h2>
              <p className="mx-auto mt-2 max-w-[54ch] text-[14px] leading-relaxed text-white/85">
                No hay categorías de socio ni privilegios comprados: lo que sube contigo es cuánto
                decides, no cuánto pagas.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {ESCALERA.map((peldaño, i) => {
              const esActual = perfil?.level === peldaño.activo;
              // Sin los Price del tramo verificado configurados no se puede
              // anunciar su precio ni preseleccionarlo: la tarjeta vuelve al
              // texto genérico y su botón baja al alta sin `?plan`. Mejor eso
              // que ofrecer 6 €/mes que nadie puede contratar.
              const ocultarPrecioVerificado = peldaño.activo === 'verified' && !verificadoDisponible;
              const punto = ocultarPrecioVerificado ? 'Cuota + identidad verificada' : peldaño.punto;
              const hrefCta = ocultarPrecioVerificado ? '#alta' : peldaño.cta.href;
              return (
                <div
                  key={peldaño.nivel}
                  className={`relative flex flex-col rounded-tarjeta border border-linea border-t-4 ${peldaño.borde} bg-panel p-6 shadow-nav transition-transform duration-300 ease-[cubic-bezier(.16,1,.3,1)] hover:-translate-y-1 hover:shadow-tarjeta ${
                    esActual ? 'ring-2 ring-accion/40' : ''
                  }`}
                >
                  {/* Aro numerado en el color del peldaño: la progresión
                      1→2→3 se lee antes por el color que por el texto. */}
                  <span
                    className={`grid h-11 w-11 place-items-center rounded-full ${peldaño.aro} text-[17px] font-extrabold text-white`}
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <h3 className="mt-4 text-[18px] font-extrabold text-titular">
                    {peldaño.nivel}
                    {esActual && (
                      <span className="ml-2 align-middle text-[11px] font-bold text-accion">
                        · tú
                      </span>
                    )}
                  </h3>
                  <span
                    className={`mt-2 inline-block self-start rounded-full ${peldaño.tinte} px-3 py-1 text-[11.5px] font-bold ${peldaño.texto}`}
                  >
                    {punto}
                  </span>
                  <p className="mb-5 mt-3 text-[13.5px] leading-relaxed text-cuerpo">
                    {peldaño.descripcion}
                  </p>
                  {/* `mt-auto` empuja el botón al fondo: las tres descripciones
                      no miden lo mismo y sin esto los botones quedaban a tres
                      alturas distintas. El `mb-5` del párrafo garantiza el
                      hueco mínimo cuando la tarjeta más larga no deja sobrante
                      que repartir. */}
                  <Link
                    href={hrefCta}
                    className={`mt-auto block rounded-boton ${peldaño.boton} px-4 py-2.5 text-center text-[13.5px] font-bold text-white no-underline transition-transform hover:-translate-y-0.5`}
                  >
                    {peldaño.cta.texto}
                  </Link>
                </div>
              );
            })}
          </div>
        </section>

        {/* A QUÉ VA TU CUOTA */}
        <section>
          <h2 className="text-center text-[clamp(22px,3vw,28px)] font-extrabold text-titular">
            A dónde va tu cuota
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 min-[960px]:grid-cols-4">
            {DESTINO_CUOTA.map((item) => (
              <div
                key={item.titulo}
                className="rounded-tarjeta border border-linea bg-panel p-5 shadow-nav transition-transform duration-300 ease-[cubic-bezier(.16,1,.3,1)] hover:-translate-y-1 hover:shadow-tarjeta"
              >
                <div className={`grid h-12 w-12 place-items-center rounded-full ${item.color}`}>
                  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
                    {item.icono}
                  </svg>
                </div>
                <h3 className="mt-4 text-[16px] font-extrabold text-titular">{item.titulo}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-cuerpo">{item.texto}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ALTA — destino de los botones "#alta" de la escalera. `scroll-mt`
            compensa el nav flotante, que si no tapa la cabecera al saltar. */}
        {yaSocio ? (
          <section
            id="alta"
            className="relative scroll-mt-28 overflow-hidden rounded-tarjeta border border-linea bg-panel p-8 text-center shadow-tarjeta"
          >
            {/* Filete de marca arriba: remata la caja sin recurrir al azul. */}
            <div className="absolute inset-x-0 top-0 h-1.5 bg-grad-full" aria-hidden />
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-grad">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="m5 12.5 4.5 4.5L19 7.5"
                  stroke="#fff"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <h2 className="mt-4 text-[22px] font-extrabold text-titular">Ya eres socio/a</h2>
            <p className="mx-auto mt-2 max-w-[52ch] text-[14px] text-cuerpo">
              Gestiona tu cuota, cambia de periodicidad o descarga tu certificado fiscal desde tu
              panel.
            </p>
            <Link
              href="/panel/afiliacion"
              className="mt-5 inline-block rounded-boton bg-accion px-6 py-3 text-[14px] font-bold text-white shadow-boton transition-transform hover:-translate-y-0.5"
            >
              Ir a mi perfil
            </Link>
          </section>
        ) : (
          <section
            id="alta"
            className="relative scroll-mt-28 overflow-hidden rounded-tarjeta border border-linea bg-panel shadow-tarjeta"
          >
            <div className="absolute inset-x-0 top-0 h-1.5 bg-grad-full" aria-hidden />
            <div className="p-6 min-[720px]:p-9">
              <h2 className="text-center text-[clamp(20px,3vw,24px)] font-extrabold text-titular">
                {user ? 'Elige tu cuota' : 'Da el paso'}
              </h2>

              {user ? (
                <AltaSepa
                  email={user.email ?? ''}
                  nombreInicial={perfil?.display_name ?? null}
                  planInicial={planInicial}
                  verificadoDisponible={verificadoDisponible}
                />
              ) : (
                <div className="mx-auto mt-5 max-w-[560px] space-y-5 text-center">
                  <p className="text-[14.5px] leading-relaxed text-cuerpo">
                    Para hacerte socio necesitas una cuenta (registro sin fricción: Google,
                    Facebook o email, sin verificación previa). Una vez dentro, vuelves aquí y
                    completas tu domiciliación sin salir de la web.
                  </p>
                  <Link
                    href="/entrar?next=/unete"
                    className="block w-full rounded-boton bg-grad px-5 py-4 text-center text-[15px] font-bold text-white shadow-[0_10px_26px_rgba(139,48,217,.28)] transition-transform hover:-translate-y-0.5"
                  >
                    Entra o regístrate para hacerte socio
                  </Link>
                  <p className="text-[12.5px] text-gris">
                    Tu cuota desgrava en el IRPF (20%, hasta 600 €/año). Recibirás certificado
                    fiscal anual descargable desde tu perfil.
                  </p>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </Contenedor>
  );
}
