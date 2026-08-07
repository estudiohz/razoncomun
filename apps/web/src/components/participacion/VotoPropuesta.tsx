'use client';

import { useTransition } from 'react';
import { alternarPosturaAction } from '@/app/propuestas/actions';
import { cn } from '@/lib/cn';
import type { Postura } from '@/lib/participacion/proposals';

/**
 * Apoyar / en contra, 1-clic (registered+), mutuamente excluyentes (0045: una
 * propuesta con 500 votos y solo 20 "apoyos" no es una propuesta sin
 * oposición — es una con 480 en contra que antes no quedaba reflejada).
 * Optimista: si la Server Action falla (p.ej. sin sesión) redirige a /entrar.
 *
 * En móvil ambos botones ocupan el 100% del ancho, apilados, con separación
 * entre ellos — en vez de partirse a la mitad o quedar descuadrados junto al
 * resto de acciones.
 */
export function VotoPropuesta({
  proposalId,
  posturaInicial,
  apoyosIniciales,
  contrasIniciales,
}: {
  proposalId: string;
  posturaInicial: Postura | null;
  apoyosIniciales: number;
  contrasIniciales: number;
}) {
  const [pendiente, iniciarTransicion] = useTransition();

  function votar(deseada: Postura) {
    iniciarTransicion(() => alternarPosturaAction(proposalId, deseada));
  }

  return (
    <div className="flex w-full flex-col gap-3 min-[480px]:flex-row">
      <button
        type="button"
        disabled={pendiente}
        onClick={() => votar('support')}
        className={cn(
          'inline-flex w-full items-center justify-center gap-2 rounded-boton border px-5 py-2.5 text-[14px] font-bold transition-colors min-[480px]:w-auto',
          posturaInicial === 'support'
            ? 'border-accion bg-accion text-white'
            : 'border-linea bg-white text-titular hover:border-titular',
          pendiente && 'opacity-60',
        )}
      >
        <span aria-hidden>👍</span>
        {posturaInicial === 'support' ? 'Ya apoyas esta propuesta' : 'Apoyar'}
        <span className="rounded-full bg-black/[.06] px-2 py-0.5 text-[12px]">{apoyosIniciales}</span>
      </button>

      <button
        type="button"
        disabled={pendiente}
        onClick={() => votar('oppose')}
        className={cn(
          'inline-flex w-full items-center justify-center gap-2 rounded-boton border px-5 py-2.5 text-[14px] font-bold transition-colors min-[480px]:w-auto',
          posturaInicial === 'oppose'
            ? 'border-titular bg-titular text-white'
            : 'border-linea bg-white text-titular hover:border-titular',
          pendiente && 'opacity-60',
        )}
      >
        <span aria-hidden>👎</span>
        {posturaInicial === 'oppose' ? 'Ya estás en contra' : 'En contra'}
        <span className="rounded-full bg-black/[.06] px-2 py-0.5 text-[12px]">{contrasIniciales}</span>
      </button>
    </div>
  );
}
