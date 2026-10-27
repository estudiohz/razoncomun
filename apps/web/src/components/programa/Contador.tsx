'use client';

import { useEffect, useRef, useState } from 'react';

/** Cifra que sube de 0 al valor al entrar en pantalla (respeta reduced-motion). */
export function Contador({ valor, className }: { valor: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [mostrado, setMostrado] = useState(valor);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setMostrado(0);
    let raf = 0;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        const inicio = performance.now();
        const paso = (t: number) => {
          const p = Math.min((t - inicio) / 1100, 1);
          setMostrado(Math.round(valor * (1 - Math.pow(1 - p, 3))));
          if (p < 1) raf = requestAnimationFrame(paso);
        };
        raf = requestAnimationFrame(paso);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [valor]);

  return (
    <span ref={ref} className={className}>
      {mostrado.toLocaleString('es-ES')}
    </span>
  );
}
