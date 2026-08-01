'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ExportarBorrarCuenta() {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [texto, setTexto] = useState('');
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function borrarCuenta() {
    if (texto !== 'BORRAR') return;
    setBorrando(true);
    setError(null);
    const res = await fetch('/api/perfil/borrar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ confirmacion: texto }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'No hemos podido borrar la cuenta.');
      setBorrando(false);
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <a
          href="/api/perfil/exportar"
          className="rounded-boton border border-linea bg-white px-4 py-2.5 text-[13.5px] font-semibold text-cuerpo hover:border-titular hover:text-titular"
        >
          Descargar mis datos (JSON)
        </a>
      </div>

      {!confirmando ? (
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="text-[13.5px] font-semibold text-magenta underline"
        >
          Borrar mi cuenta
        </button>
      ) : (
        <div className="space-y-3 rounded-boton border border-magenta/30 bg-magenta/5 p-4">
          <p className="text-[13.5px] text-cuerpo">
            Esto borra tu cuenta y tu perfil de forma permanente (no se puede deshacer). Escribe{' '}
            <strong>BORRAR</strong> para confirmar.
          </p>
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="w-full rounded-boton border border-linea bg-white px-4 py-2.5 text-[15px]"
            placeholder="BORRAR"
          />
          {error && <p className="text-[13px] font-medium text-magenta">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={texto !== 'BORRAR' || borrando}
              onClick={borrarCuenta}
              className="rounded-boton bg-magenta px-5 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-40"
            >
              {borrando ? 'Borrando…' : 'Confirmar borrado'}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmando(false);
                setTexto('');
              }}
              className="rounded-boton border border-linea px-5 py-2.5 text-[13.5px] font-semibold text-cuerpo"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
