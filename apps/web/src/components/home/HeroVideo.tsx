'use client';

import { useEffect, useRef, useState } from 'react';

const CLASES =
  'hero-personas absolute bottom-0 right-[4%] z-0 h-[91%] w-auto max-w-[56%] object-cover object-right-bottom max-[960px]:right-0 max-[960px]:h-auto max-[960px]:max-h-[82%] max-[960px]:max-w-[44%]';

/**
 * Vídeo de personas del hero.
 *
 * El mp4 pesa ~3,3 MB: si se descarga en la carga inicial compite por el ancho
 * de banda con el pintado y hunde el LCP en móvil (medido: 6,5 s). Aquí el
 * poster (51 KB) es lo único que se pide de entrada — es el elemento LCP — y
 * el vídeo se engancha después del evento `load`, en tiempo ocioso.
 *
 * Si el usuario pide movimiento reducido, el vídeo no se carga nunca: se queda
 * el poster fijo, igual que hace el boceto con sus animaciones.
 */
export function HeroVideo() {
  const [cargar, setCargar] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    const arrancar = () => {
      const idle =
        window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 200));
      idle(() => setCargar(true));
    };

    if (document.readyState === 'complete') {
      arrancar();
      return;
    }
    window.addEventListener('load', arrancar, { once: true });
    return () => window.removeEventListener('load', arrancar);
  }, []);

  useEffect(() => {
    if (cargar) ref.current?.load();
  }, [cargar]);

  return (
    <video
      ref={ref}
      className={CLASES}
      autoPlay
      muted
      loop
      playsInline
      preload="none"
      poster="/personas-poster-teal.jpg"
      aria-label="Personas de todas las edades y orígenes mirando a cámara"
    >
      {cargar && <source src="/personas-loop-teal.mp4" type="video/mp4" />}
    </video>
  );
}
