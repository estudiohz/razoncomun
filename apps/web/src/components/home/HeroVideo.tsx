'use client';

import { useEffect, useRef, useState } from 'react';

const CLASES =
  'hero-personas pointer-events-none absolute bottom-0 right-[4%] z-0 h-[91%] w-auto max-w-[56%] object-cover object-right-bottom max-[960px]:right-0 max-[960px]:h-auto max-[960px]:max-h-[82%] max-[960px]:max-w-[44%]';

/**
 * Vídeo de personas del hero — comportamiento de BACKGROUND puro y transparente
 * en TODOS los navegadores, cada uno con su formato de alpha:
 *
 * - Chrome/Firefox/Edge/Android → WebM VP9 con canal alpha.
 * - WebKit (Safari macOS y TODOS los navegadores de iOS/iPadOS, que por
 *   imposición de Apple usan su motor) ignora el alpha de VP9; su formato de
 *   vídeo transparente es HEVC con capa alpha (hvc1). El .mov lo genera el
 *   workflow gen-hevc-alpha.yml en un runner macOS (VideoToolbox).
 *
 * Rendimiento: el poster WebP transparente (25 KB) es el elemento LCP y lo
 * único que se pide de entrada. El vídeo se engancha tras `load`, en tiempo
 * ocioso, con play() explícito y muted fijado por propiedad (React no
 * serializa el atributo muted en SSR). El <video> solo se hace visible cuando
 * dispara `playing`: si el autoplay se bloquea o el formato falla, queda la
 * imagen transparente — nunca un vídeo pausado con overlay ni una caja opaca.
 *
 * Con `prefers-reduced-motion`, el vídeo no se carga: poster fijo.
 */
export function HeroVideo() {
  const [cargar, setCargar] = useState(false);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [fmt, setFmt] = useState<'webm' | 'hevc'>('webm');
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const ua = navigator.userAgent;
    // WebKit: cualquier navegador en iOS/iPadOS (el iPad moderno se anuncia
    // como MacIntel táctil) o Safari de escritorio → HEVC alpha.
    const esIOS =
      /iP(hone|ad|od)/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const esSafariEscritorio = /safari/i.test(ua) && !/chrome|crios|fxios|edg|android/i.test(ua);
    if (esIOS || esSafariEscritorio) setFmt('hevc');

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
      // Autoplay bloqueado: el <video> permanece invisible y queda el poster.
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
          {fmt === 'hevc' ? (
            <source src="/personas-loop-hevc.mov" type="video/quicktime" />
          ) : (
            <source src="/personas-loop.webm" type="video/webm" />
          )}
        </video>
      )}
    </>
  );
}
