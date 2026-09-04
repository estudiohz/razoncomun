import { Contenedor } from './Contenedor';

/**
 * Banda de donación, justo encima del footer y en toda la web pública
 * (Sergio, 10/08/2026). Deliberadamente minimalista: una línea de texto y un
 * botón. No compite con el CTA de socio de cada página — la donación es la
 * puerta pequeña, para quien no quiere (o no puede) comprometerse a una cuota.
 *
 * El destino es una página de Stripe (Payment Link) que **admite donaciones
 * anónimas**: por eso el botón sale de la web en vez de abrir el flujo SEPA
 * interno, que exige cuenta, NIF y consentimiento del art. 9 RGPD. Quien dona
 * ahí no queda registrado como socio ni entra en el censo.
 *
 * La URL vive en `NEXT_PUBLIC_STRIPE_DONACION_URL` y no en el código: así se
 * cambia el Payment Link desde Dokploy sin tocar ni redesplegar la app. Si la
 * variable NO está definida, **la banda entera no se monta**: preferible que
 * no exista a que exista con un botón muerto o apuntando a un enlace de
 * pruebas.
 */
export function BandaDonacion() {
  const url = process.env.NEXT_PUBLIC_STRIPE_DONACION_URL?.trim();
  if (!url) return null;

  return (
    <section className="border-t border-linea bg-panel py-10" aria-labelledby="titulo-donacion">
      <Contenedor>
        <div className="mx-auto flex max-w-[820px] flex-col items-center gap-5 text-center min-[720px]:flex-row min-[720px]:justify-between min-[720px]:text-left">
          <div>
            <h2 id="titulo-donacion" className="text-[19px] font-extrabold text-titular">
              Dona a Razón Común
            </h2>
            <p className="mt-1 max-w-[52ch] text-[14px] leading-relaxed text-cuerpo">
              Ayúdanos con lo que puedas. Sin cuota, sin cuenta y sin dar tus datos: cada euro va
              a difusión y herramientas, y se publica en{' '}
              {/* Enlace a /cuentas: la promesa de transparencia es lo que hace
                  creíble el "dona"; sin ella es solo un botón de pedir. */}
              <a href="/cuentas" className="font-semibold text-accion underline underline-offset-2">
                nuestras cuentas
              </a>
              .
            </p>
          </div>
          {/* Enlace externo a Stripe: `rel="noopener"` obligatorio con
              `target="_blank"`, y `flex-shrink-0` para que el botón no se
              estruje cuando el texto de al lado es largo. */}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 rounded-boton bg-grad px-7 py-3 text-[14.5px] font-bold text-white no-underline shadow-[0_8px_22px_rgba(27,61,156,.25)] transition-transform hover:-translate-y-0.5"
          >
            Donar
          </a>
        </div>
      </Contenedor>
    </section>
  );
}
