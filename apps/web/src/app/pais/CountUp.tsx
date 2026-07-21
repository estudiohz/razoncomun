'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Número animado (count-up) — cabecera de `/pais` (docs/tecnico/
 * simulador-pais.md §5). El primer render (SSR incluido) muestra SIEMPRE el
 * valor real de inmediato — nunca "0" — porque esta cifra (el balance) va en
 * el HTML servido, en la vista previa social (OG) y puede leerse antes de que
 * corra ningún `requestAnimationFrame` (pestaña en segundo plano, crawler,
 * cliente sin JS). Un "0 €" pintado en color de déficit es peor que no animar
 * nada: la verdad nunca puede depender de una animación (hallazgo QA F-1).
 *
 * En cada cambio POSTERIOR de `value` (palanca movida en el sandbox) sí
 * interpola desde el valor mostrado anteriormente — nunca desde cero — para
 * que se perciba como una actualización en vivo, no un reinicio.
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
  const [mostrado, setMostrado] = useState(() => value);
  const previoRef = useRef(value);
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
