'use client';

import { useTransition } from 'react';
import { alternarSuscripcionAction } from '@/app/propuestas/actions';
import { cn } from '@/lib/cn';

/** Campanita de suscripción al hilo (D-P9, sobre `follows`). */
export function SuscripcionBoton({
  proposalId,
  siguiendoInicial,
}: {
  proposalId: string;
  siguiendoInicial: boolean;
}) {
  const [pendiente, iniciar] = useTransition();

  return (
    <button
      type="button"
      disabled={pendiente}
      onClick={() => iniciar(() => alternarSuscripcionAction(proposalId))}
      className={cn(
        'inline-flex items-center gap-2 rounded-boton border px-4 py-2 text-[13.5px] font-bold transition-colors',
        siguiendoInicial ? 'border-accion bg-accion/10 text-titular' : 'border-linea bg-white text-cuerpo hover:border-titular',
        pendiente && 'opacity-60',
      )}
      aria-pressed={siguiendoInicial}
      title={siguiendoInicial ? 'Dejar de seguir este hilo' : 'Seguir este hilo (avisos de novedades)'}
    >
      <span aria-hidden>{siguiendoInicial ? '🔔' : '🔕'}</span>
      {siguiendoInicial ? 'Siguiendo' : 'Seguir'}
    </button>
  );
}
