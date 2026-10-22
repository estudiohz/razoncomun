'use client';

import { useState } from 'react';
import type { EstadoIdentidad } from '@/lib/stripe/identidad';

const AVISO: Record<Exclude<EstadoIdentidad, 'ninguno'>, string> = {
  en_revision:
    'Has iniciado la verificación y Stripe aún no nos ha enviado el resultado. Suele tardar unos minutos. Si cerraste la ventana antes de terminar, puedes volver a empezar.',
  rechazado: 'Stripe no ha podido verificar tu identidad.',
  cancelado: 'La verificación se canceló antes de terminar.',
  sin_socio:
    'Tu identidad se verificó, pero en ese momento tu cuota no estaba activa, así que no hemos podido subirte de nivel. Reactiva tu cuota y vuelve a verificarte.',
};

export function VerificarIdentidad({
  estado = 'ninguno',
  motivo = null,
}: {
  estado?: EstadoIdentidad;
  motivo?: string | null;
}) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function empezar() {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe/identity/create-session', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'No hemos podido iniciar la verificación.');
        setCargando(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError('No hemos podido conectar. Inténtalo de nuevo.');
      setCargando(false);
    }
  }

  const reintento = estado !== 'ninguno';
  const etiqueta = cargando
    ? 'Abriendo Stripe Identity…'
    : reintento
      ? 'Reintentar la verificación'
      : 'Verificar mi identidad';

  return (
    <div className="space-y-2">
      {reintento && (
        <p
          role="status"
          className={`rounded-boton border border-linea px-3 py-2 text-[13px] ${
            estado === 'en_revision' ? 'text-cuerpo' : 'font-medium text-magenta'
          }`}
        >
          {AVISO[estado]}
          {motivo && <> {motivo}</>}
        </p>
      )}
      <button
        type="button"
        onClick={empezar}
        disabled={cargando}
        className="rounded-boton bg-accion px-5 py-2.5 text-[13.5px] font-bold text-white shadow-boton hover:-translate-y-0.5 disabled:opacity-50"
      >
        {etiqueta}
      </button>
      {error && <p className="text-[13px] font-medium text-magenta">{error}</p>}
      <p className="text-[12px] text-gris">
        Documento + selfie los procesa Stripe. Nosotros solo recibimos el resultado (sí/no) — nunca
        guardamos tu documento ni tu biometría.
      </p>
    </div>
  );
}
