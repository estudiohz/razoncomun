import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Chip de filtro (usado en el blog por rc-05; vive en el sistema de diseño). */
export function Chip({
  children,
  href = '#',
  activo = false,
}: {
  children: ReactNode;
  href?: string;
  activo?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'whitespace-nowrap rounded-full border px-[18px] py-[9px] text-[13.5px] font-semibold no-underline transition-colors duration-200',
        activo
          ? 'border-accion bg-accion text-white'
          : 'border-linea bg-white text-cuerpo hover:border-titular hover:text-titular',
      )}
    >
      {children}
    </Link>
  );
}
