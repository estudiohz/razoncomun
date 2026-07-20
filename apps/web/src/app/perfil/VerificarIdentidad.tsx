'use client';

import { useState } from 'react';

export function VerificarIdentidad() {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function empezar() {
    setCargando(true);
    setError(null);
    const res = await fetch('/api/stripe/identity/create-session', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'No hemos podido iniciar la verificación.');
      setCargando(false);
      return;
    }
    window.location.href = data.url;
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={empezar}
        disabled={cargando}
        className="rounded-boton bg-accion px-5 py-2.5 text-[13.5px] font-bold text-white shadow-boton hover:-translate-y-0.5 disabled:opacity-50"
      >
        {cargando ? 'Abriendo Stripe Identity…' : 'Verificar mi identidad'}
      </button>
      {error && <p className="text-[13px] font-medium text-magenta">{error}</p>}
      <p className="text-[12px] text-gris">
        Documento + selfie los procesa Stripe. Nosotros solo recibimos el resultado (sí/no) — nunca
        guardamos tu documento ni tu biometría.
      </p>
    </div>
  );
}
