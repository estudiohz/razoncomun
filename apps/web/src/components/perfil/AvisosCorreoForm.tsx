'use client';

import { useState, useTransition } from 'react';
import { cambiarAvisosCorreoAction } from '@/app/perfil/actions';

/** Interruptor de los avisos de participación por correo (0077). */
export function AvisosCorreoForm({ activo }: { activo: boolean }) {
  const [valor, setValor] = useState(activo);
  const [error, setError] = useState(false);
  const [pendiente, iniciar] = useTransition();

  return (
    <div>
      <label className="flex items-start gap-2.5 text-[13.5px] text-cuerpo">
        <input
          type="checkbox"
          checked={valor}
          disabled={pendiente}
          onChange={(e) => {
            const nuevo = e.target.checked;
            setValor(nuevo);
            setError(false);
            iniciar(async () => {
              const r = await cambiarAvisosCorreoAction(nuevo);
              if (!r.ok) {
                setValor(!nuevo);
                setError(true);
              }
            });
          }}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-linea text-accion focus:ring-titular/30"
        />
        <span>
          Avisarme por correo de la encuesta de cada mes y recordármela si aún no he participado.
        </span>
      </label>
      {error && <p className="mt-2 text-[12.5px] text-magenta">No se ha podido guardar. Inténtalo de nuevo.</p>}
    </div>
  );
}
