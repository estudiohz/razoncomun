'use client';

import { useTransition } from 'react';
import { alternarApoyoAction } from '@/app/propuestas/actions';
import { cn } from '@/lib/cn';

/** Apoyo 1-clic (registered+). Optimista: si la Server Action falla (p.ej. sin sesión, redirige a /entrar). */
export function ApoyoBoton({
  proposalId,
  apoyaInicial,
  totalInicial,
}: {
  proposalId: string;
  apoyaInicial: boolean;
  totalInicial: number;
}) {
  const [pendiente, iniciarTransicion] = useTransition();

  return (
    <button
      type="button"
      disabled={pendiente}
      onClick={() => iniciarTransicion(() => alternarApoyoAction(proposalId))}
      className={cn(
        'inline-flex items-center gap-2 rounded-boton border px-5 py-2.5 text-[14px] font-bold transition-colors',
        apoyaInicial
          ? 'border-accion bg-accion text-white'
          : 'border-linea bg-white text-titular hover:border-titular',
        pendiente && 'opacity-60',
      )}
    >
      <span aria-hidden>👍</span>
      {apoyaInicial ? 'Ya apoyas esta propuesta' : 'Apoyar esta propuesta'}
      <span className="rounded-full bg-black/[.06] px-2 py-0.5 text-[12px]">{totalInicial}</span>
    </button>
  );
}
