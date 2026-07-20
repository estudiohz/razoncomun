import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Superficie base (panel blanco con borde y radio de marca). */
export function Tarjeta({
  children,
  className,
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-tarjeta border border-linea bg-panel',
        hover &&
          'transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(.16,1,.3,1)] hover:-translate-y-1 hover:shadow-tarjeta',
        className,
      )}
    >
      {children}
    </div>
  );
}
