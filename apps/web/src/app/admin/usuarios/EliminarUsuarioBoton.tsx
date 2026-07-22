'use client';

import { useEffect, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { eliminarUsuario } from './actions';

/**
 * Botón "Eliminar" del listado de usuarios, SOLO visible para admins (lo
 * decide el server component que lo monta). Doble confirmación pedida por
 * Sergio: (1) clic en Eliminar abre el modal con nombre+email del usuario;
 * (2) dentro del modal hay que marcar la casilla "Entiendo que es
 * irreversible" antes de que el botón rojo se active. Modal por portal a
 * <body> (mismo patrón que CerebroClient — el overlay dentro de un
 * contenedor con backdrop-blur se rompería, lección del burger móvil).
 */
export function EliminarUsuarioBoton({
  userId,
  nombre,
  email,
}: {
  userId: string;
  nombre: string;
  email: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [entendido, setEntendido] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const [montado, setMontado] = useState(false);

  useEffect(() => setMontado(true), []);

  function abrir() {
    setEntendido(false);
    setError(null);
    setAbierto(true);
  }

  function confirmar() {
    startTransition(async () => {
      const resultado = await eliminarUsuario(userId);
      if (resultado.ok) {
        setAbierto(false);
        router.refresh();
      } else {
        setError(resultado.error ?? 'No se pudo eliminar.');
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="text-[12px] font-bold text-red-600 underline-offset-2 hover:underline"
      >
        Eliminar
      </button>

      {abierto &&
        montado &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Confirmar eliminación de usuario"
            className="fixed inset-0 z-[70] flex items-center justify-center bg-noche/40 p-4"
            onClick={() => !pendiente && setAbierto(false)}
          >
            <div
              className="w-full max-w-md rounded-tarjeta border border-linea bg-white p-6 shadow-nav motion-safe:animate-[sube_.25s_ease]"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-[19px] font-bold text-titular">¿Eliminar esta cuenta?</h2>
              <p className="mt-2 text-[14px] text-cuerpo">
                <strong>{nombre}</strong> <span className="text-gris">({email})</span>
              </p>
              <p className="mt-2 text-[14px] text-cuerpo">
                Se borra la cuenta y su perfil de forma permanente. El usuario dejará de poder
                entrar y no se puede deshacer.
              </p>

              <label className="mt-4 flex items-start gap-2 text-[13.5px] text-cuerpo">
                <input
                  type="checkbox"
                  checked={entendido}
                  onChange={(e) => setEntendido(e.target.checked)}
                  disabled={pendiente}
                  className="mt-0.5 h-4 w-4 accent-red-600"
                />
                <span>Entiendo que esta acción es irreversible.</span>
              </label>

              {error && (
                <p className="mt-3 rounded-boton bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-700">
                  {error}
                </p>
              )}

              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setAbierto(false)}
                  disabled={pendiente}
                  className="rounded-boton border border-linea bg-white px-4 py-2 text-[14px] font-bold text-titular hover:border-titular disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmar}
                  disabled={pendiente || !entendido}
                  className="rounded-boton bg-red-600 px-4 py-2 text-[14px] font-bold text-white transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {pendiente ? 'Eliminando…' : 'Eliminar definitivamente'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
