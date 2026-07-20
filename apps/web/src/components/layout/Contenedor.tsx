import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Contenedor central (.wrap del boceto: max 1240px, padding lateral 32px). */
export function Contenedor({
  children,
  className,
  as: Etiqueta = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: ElementType;
}) {
  return (
    <Etiqueta className={cn('mx-auto w-full max-w-wrap px-8', className)}>
      {children}
    </Etiqueta>
  );
}
