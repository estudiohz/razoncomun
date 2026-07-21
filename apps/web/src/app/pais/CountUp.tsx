'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Número animado (count-up) — cabecera de `/pais` (docs/tecnico/
 * simulador-pais.md §5). Arranca en 0 en el primer render (efecto de
 * entrada) y, en cada cambio posterior de `value` (palanca movida en el
 * sandbox), interpola desde el valor mostrado anteriormente — nunca desde
 * cero — para que se perciba como una actualización en vivo, no un reinicio.
 *
 * Respeta `prefers-reduced-motion`: si el usuario lo pide, salta directo al
 * valor final sin interpolar.
 */
export function CountUp({
  value,
  formatear,
  duracionMs = 650,
}: {
  value: number;
  formatear: (n: number) => string;
  duracionMs?: number;
}) {
  const [mostrado, setMostrado] = useState(0);
  const previoRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const desde = previoRef.current;
    const hasta = value;

    if (Math.abs(hasta - desde) < 0.5) {
      previoRef.current = hasta;
      setMostrado(hasta);
      return;
    }

    const reduce =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      previoRef.current = hasta;
      setMostrado(hasta);
      return;
    }

    let cancelado = false;
    const inicio = performance.now();

    function tick(ahora: number) {
      if (cancelado) return;
      const t = Math.min(1, (ahora - inicio) / duracionMs);
      const suavizado = 1 - (1 - t) ** 3; // ease-out cúbico
      const valorFrame = desde + (hasta - desde) * suavizado;
      setMostrado(valorFrame);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        previoRef.current = hasta;
      }
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      cancelado = true;
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duracionMs]);

  return <>{formatear(mostrado)}</>;
}
