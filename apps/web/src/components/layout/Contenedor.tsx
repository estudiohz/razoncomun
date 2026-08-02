import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Contenedor central (.wrap del boceto: max 1400px, padding lateral 32px).
 *
 * En móvil el padding baja a 16px (02/08/2026, petición de Sergio: "con la
 * mitad del margen se vería mejor"): 32px por lado en una pantalla de 375px,
 * sumados al padding interno de cada tarjeta, dejaban el contenido en un
 * pasillo estrecho. 16px además ALINEA el contenido con la barra de
 * navegación, que ya usaba px-4 en móvil.
 */
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
    <Etiqueta className={cn('mx-auto w-full max-w-wrap px-4 min-[720px]:px-8', className)}>
      {children}
    </Etiqueta>
  );
}
