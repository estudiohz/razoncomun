'use client';

import { useState, useTransition } from 'react';
import { reenviarRecuperacion, type ResultadoRecuperacion } from './actions';

/**
 * Botón de la ficha de usuario (solo admin; lo monta el server component).
 * Para "no me llega el correo de recuperación". Si el correo no sale, enseña el
 * enlace para pasarlo por otro canal (WhatsApp, etc.).
 */
export function ReenviarRecuperacionBoton({ userId }: { userId: string }) {
  const [pendiente, startTransition] = useTransition();
  const [resultado, setResultado] = useState<ResultadoRecuperacion | null>(null);

  function enviar() {
    setResultado(null);
    startTransition(async () => {
      setResultado(await reenviarRecuperacion(userId));
    });
  }

  return (
    <div className="shrink-0 text-right">
      <button
        type="button"
        onClick={enviar}
        disabled={pendiente}
        className="rounded-boton border border-linea bg-white px-3 py-1.5 text-[12.5px] font-bold text-titular hover:border-titular disabled:opacity-60"
      >
        {pendiente ? 'Enviando…' : 'Reenviar email de recuperación'}
      </button>
      {resultado && !resultado.ok && (
        <p className="mt-2 max-w-[260px] text-[12px] font-semibold text-[#c0392b]">{resultado.error}</p>
      )}
      {resultado?.ok && resultado.emailEnviado && (
        <p className="mt-2 max-w-[260px] text-[12px] text-gris">
          Enviado a {resultado.email}. Si no llega, que mire el correo no deseado.
        </p>
      )}
      {resultado?.ok && !resultado.emailEnviado && resultado.enlace && (
        <div className="mt-2 max-w-[260px] text-left text-[12px] text-gris">
          <p className="font-semibold text-[#c0392b]">El correo no ha podido salir.</p>
          <p className="mt-1">Pásale este enlace por otro canal:</p>
          <input
            readOnly
            value={resultado.enlace}
            onFocus={(e) => e.currentTarget.select()}
            className="mt-1 w-full rounded border border-linea px-2 py-1 text-[11.5px]"
          />
        </div>
      )}
    </div>
  );
}
