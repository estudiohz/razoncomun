'use client';

import { useState, useTransition } from 'react';
import { enviarmePrueba } from './actions';

export function BotonPrueba({ email }: { email: string | null }) {
  const [msg, setMsg] = useState<{ ok: boolean; mensaje: string } | null>(null);
  const [pendiente, start] = useTransition();
  return (
    <>
      <button
        type="button"
        disabled={pendiente || !email}
        onClick={() => start(async () => setMsg(await enviarmePrueba()))}
        className="rounded-boton border border-linea bg-white px-4 py-2 text-[13px] font-bold text-titular disabled:opacity-50"
      >
        {pendiente ? 'Enviando…' : 'Enviarme una prueba'}
      </button>
      {msg && <span className={`text-[12.5px] ${msg.ok ? 'text-teal-texto' : 'text-magenta'}`}>{msg.mensaje}</span>}
    </>
  );
}
