import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variante = 'grad' | 'suave' | 'marca' | 'heroSuave';

const base =
  'inline-flex items-center justify-center gap-2 rounded-boton px-[30px] py-[13px] text-[15px] font-bold no-underline transition-transform duration-200 active:scale-[.98]';

const variantes: Record<Variante, string> = {
  // Botón sólido teal del boceto (.btn-grad)
  grad: 'bg-accion text-white shadow-boton hover:-translate-y-0.5',
  // Botón claro sobre fondo blanco (.btn-suave)
  suave: 'bg-white text-titular border border-linea hover:border-titular',
  // Botón con degradado de marca (CTA final)
  marca: 'bg-grad text-white shadow-[0_8px_22px_rgba(27,61,156,.25)] hover:-translate-y-0.5',
  // Botón claro traslúcido sobre el hero
  heroSuave:
    'bg-white/[.12] text-white border border-white/40 hover:bg-white/20',
};

interface BotonProps {
  children: ReactNode;
  href: string;
  variante?: Variante;
  className?: string;
}

/** Botón/enlace del sistema de diseño. Todos los CTA del boceto pasan por aquí. */
export function Boton({
  children,
  href,
  variante = 'grad',
  className,
  ...rest
}: BotonProps & Omit<ComponentProps<typeof Link>, 'href' | 'className'>) {
  return (
    <Link href={href} className={cn(base, variantes[variante], className)} {...rest}>
      {children}
    </Link>
  );
}
