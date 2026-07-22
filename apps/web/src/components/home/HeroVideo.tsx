'use client';

import { useEffect, useRef, useState } from 'react';

const CLASES =
  'hero-personas pointer-events-none absolute bottom-0 right-[4%] z-0 h-[91%] w-auto max-w-[56%] object-cover object-right-bottom max-[960px]:right-0 max-[960px]:h-auto max-[960px]:max-h-[82%] max-[960px]:max-w-[44%]';

/**
 * Vídeo de personas del hero — comportamiento de BACKGROUND puro.
 *
 * Rendimiento: el mp4/webm pesa ~3-5 MB; si se descargara en la carga inicial
 * competiría con el pintado y hundiría el LCP en móvil (medido: 6,5 s). El
 * poster WebP (25 KB) es lo único que se pide de entrada — es el elemento
 * LCP — y el vídeo se engancha tras el evento `load`, en tiempo ocioso.
 *
 * Sin icono de play, nunca: el poster se muestra como <img> y el <video> solo
 * se hace visible cuando dispara `playing` de verdad. Si el navegador bloquea
 * el autoplay (ahorro de energía, navegadores de fabricante que pintan un play
 * sobre vídeos pausados, etc.), el usuario ve la imagen fija — jamás un vídeo
 * pausado con overlay del navegador. Además `muted` se fija por propiedad en
 * el ref: React no serializa el atributo en el HTML del servidor (bug
 * conocido) y sin él las políticas de autoplay móviles bloquean el play().
 *
 * Con `prefers-reduced-motion`, el vídeo no se carga: queda el poster fijo.
 */
export function HeroVideo() {
  const [cargar, setCargar] = useState(false);
  const [reproduciendo, setReproduciendo] = useState(false);
  // 'webm' = vídeo con canal alpha (fondo transparente: deja ver el degradado
  // real del hero). Safari decodifica VP9 pero IGNORA el alpha y pintaría el
  // fondo en negro, así que ahí servimos el mp4 opaco de respaldo (fondo
  // morado horneado, disimulado por la máscara CSS de .hero-personas).
  const [fmt, setFmt] = useState<'webm' | 'mp4'>('webm');
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const esSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);
    if (esSafari) setFmt('mp4');
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
    const v = ref.current;
    if (!cargar || !v) return;
    // Propiedades ANTES de load(): condición de las políticas de autoplay.
    v.muted = true;
    v.defaultMuted = true;
    v.load();
    v.play().catch(() => {
      // Autoplay bloqueado: nos quedamos con el poster (estado 'reproduciendo'
      // nunca se activa y el <video> permanece invisible).
    });
  }, [cargar]);

  return (
    <>
      {!reproduciendo && (
        <img
          src="/personas-poster.webp"
          className={CLASES}
          alt="Personas de todas las edades y orígenes mirando a cámara"
          decoding="async"
        />
      )}
      {cargar && (
        <video
          ref={ref}
          className={`${CLASES} ${reproduciendo ? '' : 'invisible'}`}
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          disablePictureInPicture
          disableRemotePlayback
          aria-hidden
          onPlaying={() => setReproduciendo(true)}
        >
          {fmt === 'webm' ? (
            <source src="/personas-loop.webm" type="video/webm" />
          ) : (
            <source src="/personas-loop-teal.mp4" type="video/mp4" />
          )}
        </video>
      )}
    </>
  );
}
