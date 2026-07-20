import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/** Input base del sistema de diseño (tema claro). */
export function Input({ className, ...rest }: ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'w-full rounded-boton border border-linea bg-white px-4 py-3 text-[15px] text-cuerpo',
        'placeholder:text-gris focus:border-titular focus:outline-none focus:ring-2 focus:ring-titular/20',
        className,
      )}
      {...rest}
    />
  );
}
