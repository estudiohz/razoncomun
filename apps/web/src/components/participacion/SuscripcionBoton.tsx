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
  const explicacion = siguiendoInicial
    ? 'Dejar de seguir este hilo: no llegarán más avisos a tu campanita de notificaciones.'
    : 'Al seguir este hilo, cada comentario o respuesta oficial nueva te avisa en la campanita de notificaciones (arriba, en el menú). No se envían emails.';

  return (
    <button
      type="button"
      disabled={pendiente}
      onClick={() => iniciar(() => alternarSuscripcionAction(proposalId))}
      className={cn(
        'mt-2 inline-flex w-full items-center justify-center gap-2 rounded-boton border px-4 py-2.5 text-[13.5px] font-bold transition-colors sm:w-auto',
        siguiendoInicial ? 'border-accion bg-accion/10 text-titular' : 'border-linea bg-white text-cuerpo hover:border-titular',
        pendiente && 'opacity-60',
      )}
      aria-pressed={siguiendoInicial}
      title={explicacion}
    >
      <span aria-hidden>{siguiendoInicial ? '🔔' : '🔕'}</span>
      {siguiendoInicial ? 'Siguiendo este hilo' : 'Seguir este hilo (avisos en tu campanita)'}
    </button>
  );
}
