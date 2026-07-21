import { Boton } from '@/components/ui/Boton';
import { Contenedor } from '@/components/layout/Contenedor';
import { HeroVideo } from '@/components/home/HeroVideo';

const slogans = [
  'es rigor y transparencia.',
  'es participación real.',
  'es lógica aplicada.',
  'es rigor y transparencia.',
];

/**
 * Hero: degradado teal→morado, retícula técnica que se desvanece sobre las
 * personas (vídeo anclado abajo-derecha, fundido con el morado) y rotatorio
 * de slogans en #6FE9D8. Fiel a boceto-4-teal.html.
 */
export function Hero() {
  return (
    <>
      {/* El poster del vídeo es el elemento LCP: se precarga con prioridad alta
          para que pinte sin esperar a la descarga del mp4. */}
      <link
        rel="preload"
        as="image"
        href="/personas-poster-teal.jpg"
        fetchPriority="high"
      />
    <header className="relative -mt-[92px] flex min-h-[calc(72vh-150px)] items-center overflow-hidden bg-hero pb-16 pt-[118px] text-left max-[960px]:min-h-0 max-[960px]:pb-11">
      <HeroVideo />

      <div className="hero-reticula pointer-events-none absolute inset-0 z-[1]" aria-hidden />

      <Contenedor className="relative z-[2]">
        <div className="grid grid-cols-1 items-center gap-[50px] max-[960px]:items-start max-[960px]:gap-6">
          <div>
            <h1 className="fade text-[clamp(36px,4.6vw,58px)] font-extrabold leading-[1.1] text-white">
              Razón Común
              {/* El texto accesible va en un span oculto: `aria-label` sobre un
                  <span> sin rol es un atributo ARIA prohibido (axe). El
                  rotatorio visual queda marcado como decorativo. */}
              <span className="sr-only">
                {' '}
                es rigor y transparencia, es participación real, es lógica aplicada.
              </span>
              <span className="rota" aria-hidden>
                <span className="track">
                  {slogans.map((s, i) => (
                    <i key={i}>{s}</i>
                  ))}
                </span>
              </span>
            </h1>
            <p className="fade d1 mt-5 max-w-[44ch] text-[17.5px] text-white/[.78]">
              La alternativa que estabas esperando. Cada propuesta se mide, se simula y se
              corrige — como debería haber sido siempre.
            </p>
            <div className="fade d1 mt-[30px] flex flex-wrap items-center gap-3.5">
              <Boton href="/afiliate" variante="grad">
                Afíliate
              </Boton>
              <Boton href="/manifiesto" variante="heroSuave">
                Cómo funciona
              </Boton>
            </div>
          </div>
        </div>
      </Contenedor>
    </header>
    </>
  );
}
