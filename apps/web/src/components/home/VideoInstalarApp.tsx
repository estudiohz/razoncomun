'use client';

import { useEffect, useRef } from 'react';

/**
 * Animación «cómo instalar la app» (móvil → Compartir → Añadir a pantalla de
 * inicio). Fuente editable en `media/hyperframes/instala-app` (HyperFrames).
 *
 * Solo corre mientras se ve en pantalla (ahorra batería y datos de CPU) y no
 * se reproduce sola si la persona pidió reducir el movimiento: en ese caso se
 * queda el primer fotograma (`poster`), que ya cuenta la idea.
 */
export function VideoInstalarApp() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0.35 },
    );
    io.observe(video);
    return () => io.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      className="aspect-square w-full rounded-[28px] shadow-[0_24px_60px_rgba(10,8,40,.38)] ring-1 ring-white/25"
      src="/instala-app.mp4"
      poster="/instala-app-poster.jpg"
      muted
      loop
      playsInline
      preload="none"
      aria-label="Animación: abre razoncomun.com en el móvil, pulsa Compartir y elige Añadir a pantalla de inicio"
    />
  );
}
