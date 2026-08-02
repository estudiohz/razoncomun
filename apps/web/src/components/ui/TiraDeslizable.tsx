'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Tira horizontal de chips/etiquetas para móvil, con flechas ‹ › que indican
 * e INVOCAN el desplazamiento (feedback de Sergio, 02/08/2026: el scroll
 * lateral "no se intuye de inicio" sin un icono que invite a interactuar).
 *
 * - Las flechas solo aparecen cuando hay contenido oculto hacia ese lado, y
 *   pulsarlas avanza un 60% del ancho visible con animación — son pista y
 *   control a la vez. El desvanecido del borde acompaña a cada flecha.
 * - En ≥720px se convierte en el wrap de siempre: en escritorio caben.
 * - Sangra hasta el borde físico (-mx-4) para que el gesto de arrastre no
 *   choque con el padding del contenedor (que en móvil es px-4).
 *
 * Un solo componente para blog, propuestas y la cinta de meses: el mismo
 * gesto debe funcionar igual en toda la app.
 */
export function TiraDeslizable({
  children,
  alinear = 'izquierda',
  className,
}: {
  children: ReactNode;
  /** Alineación del wrap en escritorio. */
  alinear?: 'izquierda' | 'centro';
  className?: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [haciaIzq, setHaciaIzq] = useState(false);
  const [haciaDer, setHaciaDer] = useState(false);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;

    const medir = () => {
      setHaciaIzq(el.scrollLeft > 4);
      setHaciaDer(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    };
    medir();
    el.addEventListener('scroll', medir, { passive: true });
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', medir);
      ro.disconnect();
    };
  }, []);

  const avanzar = (direccion: 1 | -1) => {
    const el = scroller.current;
    if (el) el.scrollBy({ left: direccion * el.clientWidth * 0.6, behavior: 'smooth' });
  };

  const flecha =
    'absolute top-1/2 z-10 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-linea bg-white text-titular shadow-nav min-[720px]:hidden';

  return (
    <div className={cn('relative -mx-4 min-[720px]:mx-0', className)}>
      <div
        ref={scroller}
        className={cn(
          'flex gap-2 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          'min-[720px]:flex-wrap min-[720px]:gap-2.5 min-[720px]:overflow-visible min-[720px]:px-0 min-[720px]:pb-0',
          alinear === 'centro' && 'min-[720px]:justify-center',
        )}
      >
        {children}
      </div>

      {haciaIzq && (
        <>
          <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-fondo to-transparent min-[720px]:hidden" />
          <button type="button" aria-label="Ver anteriores" onClick={() => avanzar(-1)} className={cn(flecha, 'left-1')}>
            <Chevron lado="izq" />
          </button>
        </>
      )}
      {haciaDer && (
        <>
          <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-fondo to-transparent min-[720px]:hidden" />
          <button type="button" aria-label="Ver más" onClick={() => avanzar(1)} className={cn(flecha, 'right-1')}>
            <Chevron lado="der" />
          </button>
        </>
      )}
    </div>
  );
}

/** Envoltorio de cada elemento: evita que el chip se encoja en la fila. */
export function ItemTira({ children }: { children: ReactNode }) {
  return <span className="shrink-0 min-[720px]:shrink">{children}</span>;
}

function Chevron({ lado }: { lado: 'izq' | 'der' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={lado === 'der' ? 'M9 5l7 7-7 7' : 'M15 5l-7 7 7 7'}
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
