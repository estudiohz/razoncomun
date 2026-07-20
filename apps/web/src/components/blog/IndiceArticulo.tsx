'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import type { EntradaIndice } from '@/lib/blog/tipos';

/**
 * Índice "En este artículo" (.toc del boceto), generado de los h2/h3 del
 * markdown. Único componente de cliente de la ficha: marca la sección visible
 * con `IntersectionObserver`, como el estado `.on` del boceto.
 *
 * Degrada bien: sin JS siguen siendo anclas normales que funcionan.
 */
export function IndiceArticulo({ entradas }: { entradas: EntradaIndice[] }) {
  const [activa, setActiva] = useState<string | null>(entradas[0]?.id ?? null);

  useEffect(() => {
    if (!entradas.length) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const observador = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiva(visible.target.id);
      },
      // Ventana estrecha en el tercio superior: la sección "activa" es la que
      // el lector tiene delante, no la que asoma por abajo.
      { rootMargin: '-96px 0px -66% 0px', threshold: 0 },
    );

    for (const { id } of entradas) {
      const el = document.getElementById(id);
      if (el) observador.observe(el);
    }
    return () => observador.disconnect();
  }, [entradas]);

  if (!entradas.length) return null;

  return (
    <nav className="rounded-[16px] border border-linea bg-panel p-6" aria-label="Índice">
      <h2 className="mb-4 text-[13px] font-extrabold uppercase tracking-[.08em] text-gris">
        En este artículo
      </h2>
      {entradas.map((e) => (
        <a
          key={e.id}
          href={`#${e.id}`}
          aria-current={activa === e.id ? 'true' : undefined}
          className={cn(
            'block border-l-2 py-[7px] pl-[14px] text-[14px] no-underline transition-colors duration-200',
            e.nivel === 3 && 'pl-6 text-[13.5px]',
            activa === e.id
              ? 'border-l-titular font-semibold text-titular'
              : 'border-l-linea text-cuerpo hover:border-l-titular hover:text-titular',
          )}
        >
          {e.texto}
        </a>
      ))}
    </nav>
  );
}
