import { Contenedor } from './Contenedor';

/**
 * Banda de donación, justo encima del footer y en toda la web pública
 * (Sergio, 10/08/2026; importes rápidos añadidos el 07/09/2026 a partir de
 * la banda de VOX).
 *
 * Importes rápidos + "Donar" de importe libre. El patrón funciona porque
 * quita la decisión: quien duda entre "algo" y "nada" pulsa 10 € sin
 * pensarlo, y quien quiere dar otra cosa sigue teniendo su puerta.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠️ LO 8/2007 (financiación de partidos), y NO es un detalle de redacción:
 *
 *   · Art. 5.1 — los partidos NO pueden aceptar «donaciones anónimas,
 *     finalistas o revocables». Una donación sin identificar al donante es
 *     dinero que el partido está obligado a rechazar o devolver.
 *   · Art. 4.2 — las donaciones se ingresan en una cuenta abierta
 *     EXCLUSIVAMENTE para ese fin, y debe constar el nombre y el NIF del
 *     donante.
 *   · Art. 5.1 — prohibidas las donaciones de personas jurídicas (empresas)
 *     y las de más de 50.000 € anuales por persona.
 *   · Más de 25.000 € → notificación al Tribunal de Cuentas en tres meses.
 *
 * Por eso el texto de esta banda ya NO dice "sin dar tus datos", como decía
 * antes: era describir precisamente lo que no se puede aceptar. El destino
 * de estos botones TIENE que pedir nombre y NIF, y cobrar contra la cuenta
 * de donaciones. Configurarlos apuntando a un cobro anónimo convierte un
 * problema de producto en uno de cuentas del partido.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * CONFIGURACIÓN. Dos variables, ninguna en el código:
 *
 *   NEXT_PUBLIC_DONACION_IMPORTES = "5:https://…,10:https://…,20:https://…"
 *   NEXT_PUBLIC_STRIPE_DONACION_URL = https://…   (el "Donar" libre)
 *
 * Cada importe necesita SU PROPIO enlace de cobro. Es deliberado y no es
 * pereza: un botón que pone "20 €" y lleva a un cobro de otra cantidad es
 * un cargo equivocado a una persona real, así que un importe sin enlace
 * propio configurado simplemente NO se pinta. Es imposible que esta banda
 * cobre algo distinto de lo que anuncia.
 *
 * Si no hay ninguna de las dos variables, la banda entera no se monta:
 * preferible que no exista a que exista con botones muertos.
 */

/** Importes sugeridos, en euros. El orden es el de la banda. */
const IMPORTES_SUGERIDOS = [5, 10, 20, 100, 200] as const;

/**
 * Lee el mapa `importe:url` de la variable de entorno.
 *
 * Tolerante con el formato (espacios, separadores sueltos) pero estricta con
 * lo que acepta: solo entran importes que estén en `IMPORTES_SUGERIDOS` y
 * cuya URL sea https. Cualquier otra cosa se ignora en silencio — una
 * variable mal escrita deja de pintar ese botón, no rompe la web entera.
 */
function enlacesPorImporte(): Map<number, string> {
  const mapa = new Map<number, string>();
  const crudo = process.env.NEXT_PUBLIC_DONACION_IMPORTES?.trim();
  if (!crudo) return mapa;

  for (const trozo of crudo.split(',')) {
    const sep = trozo.indexOf(':');
    if (sep < 0) continue;
    const importe = Number(trozo.slice(0, sep).trim());
    const url = trozo.slice(sep + 1).trim();
    if (!Number.isInteger(importe)) continue;
    if (!IMPORTES_SUGERIDOS.includes(importe as (typeof IMPORTES_SUGERIDOS)[number])) continue;
    if (!url.startsWith('https://')) continue;
    mapa.set(importe, url);
  }
  return mapa;
}

export function BandaDonacion() {
  const urlLibre = process.env.NEXT_PUBLIC_STRIPE_DONACION_URL?.trim();
  const enlaces = enlacesPorImporte();

  if (!urlLibre && enlaces.size === 0) return null;

  const importes = IMPORTES_SUGERIDOS.filter((i) => enlaces.has(i));

  return (
    <section className="border-t border-linea bg-panel py-8" aria-labelledby="titulo-donacion">
      <Contenedor>
        <div className="flex flex-col items-center gap-5 text-center min-[900px]:flex-row min-[900px]:justify-between min-[900px]:text-left">
          <div className="min-[900px]:max-w-[38ch]">
            <h2 id="titulo-donacion" className="text-[18px] font-extrabold text-titular">
              Dona a Razón Común
            </h2>
            <p className="mt-1 text-[13.5px] leading-relaxed text-cuerpo">
              Cada euro va a difusión y herramientas, y se publica en{' '}
              {/* Enlace a /cuentas: la promesa de transparencia es lo que hace
                  creíble el "dona"; sin ella es solo un botón de pedir. */}
              <a href="/cuentas" className="font-semibold text-accion underline underline-offset-2">
                nuestras cuentas
              </a>
              .
            </p>
          </div>

          {/* Los botones. `flex-wrap` porque en un móvil estrecho cinco
              importes más el libre no caben en una línea, y preferimos que
              bajen antes que encogerlos hasta ser impulsables por error. */}
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {importes.map((importe) => (
              <a
                key={importe}
                href={enlaces.get(importe)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Donar ${importe} euros`}
                className="rounded-boton border border-linea bg-panel px-5 py-2.5 text-[14.5px] font-bold text-titular no-underline transition-colors hover:border-titular hover:bg-fondo"
              >
                {importe}€
              </a>
            ))}

            {urlLibre && (
              <a
                href={urlLibre}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Donar otra cantidad"
                className="rounded-boton bg-grad px-6 py-2.5 text-[14.5px] font-bold text-white no-underline shadow-[0_8px_22px_rgba(27,61,156,.25)] transition-transform hover:-translate-y-0.5"
              >
                Donar
              </a>
            )}
          </div>
        </div>
      </Contenedor>
    </section>
  );
}
