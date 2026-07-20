import { cn } from '@/lib/cn';
import { ETIQUETA_ESTADO, type EstadoPropuesta } from '@/lib/participacion/types';

const COLOR: Record<EstadoPropuesta, string> = {
  seed: 'bg-linea text-cuerpo',
  deliberation: 'bg-cat-transparencia text-white',
  stress_test: 'bg-cat-educacion text-white',
  voting: 'bg-accion text-white',
  adopted: 'bg-cat-agricultura text-white',
  discarded: 'bg-gris text-white',
};

const ICONO: Record<EstadoPropuesta, string> = {
  seed: '💡',
  deliberation: '🔎',
  stress_test: '🧪',
  voting: '🗳️',
  adopted: '✅',
  discarded: '❌',
};

export function EstadoBadge({ status, className }: { status: EstadoPropuesta; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-[11.5px] font-extrabold uppercase tracking-[.06em]',
        COLOR[status],
        className,
      )}
    >
      <span aria-hidden>{ICONO[status]}</span>
      {ETIQUETA_ESTADO[status]}
    </span>
  );
}
