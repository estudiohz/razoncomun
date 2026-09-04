'use client';

import { useEffect, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { eliminarUsuario } from './actions';

/**
 * Botón de baja del listado de usuarios, SOLO visible para admins (lo decide
 * el server component que lo monta). Doble confirmación pedida por Sergio:
 * (1) el clic abre el modal con nombre+email; (2) hay que marcar la casilla
 * antes de que el botón rojo se active. Modal por portal a <body> (mismo
 * patrón que CerebroClient — el overlay dentro de un contenedor con
 * backdrop-blur se rompería, lección del burger móvil).
 *
 * El resultado NO se da por supuesto: el servidor decide si la cuenta se
 * borra del todo (no dejó rastro) o se anonimiza (dejó votos, comentarios o
 * cuota), y esas dos cosas son distintas para quien las ejecuta. Por eso el
 * modal no se cierra al terminar: enseña qué pasó de verdad.
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
  const [hecho, setHecho] = useState<{ accion?: string; fiscal?: boolean } | null>(null);
  const [pendiente, startTransition] = useTransition();
  const [montado, setMontado] = useState(false);

  useEffect(() => setMontado(true), []);

  function abrir() {
    setEntendido(false);
    setError(null);
    setHecho(null);
    setAbierto(true);
  }

  function cerrar() {
    setAbierto(false);
    if (hecho) router.refresh();
  }

  function confirmar() {
    startTransition(async () => {
      const resultado = await eliminarUsuario(userId);
      if (resultado.ok) {
        setHecho({ accion: resultado.accion, fiscal: resultado.retieneDatosFiscales });
      } else {
        setError(resultado.error ?? 'No se pudo completar la baja.');
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
        Dar de baja
      </button>

      {abierto &&
        montado &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Confirmar baja de usuario"
            className="fixed inset-0 z-[70] flex items-center justify-center bg-noche/40 p-4"
            onClick={() => !pendiente && cerrar()}
          >
            <div
              className="w-full max-w-md rounded-tarjeta border border-linea bg-white p-6 shadow-nav motion-safe:animate-[sube_.25s_ease]"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-[19px] font-bold text-titular">
                {hecho ? 'Cuenta dada de baja' : '¿Dar de baja esta cuenta?'}
              </h2>
              <p className="mt-2 text-[14px] text-cuerpo">
                <strong>{nombre}</strong> <span className="text-gris">({email})</span>
              </p>

              {hecho ? (
                <div className="mt-3 space-y-2 text-[14px] text-cuerpo">
                  {hecho.accion === 'borrada' ? (
                    <p>
                      No había dejado rastro (ni cuota, ni votos, ni propuestas), así que{' '}
                      <strong>se ha borrado del todo</strong>. Su email queda libre para volver a
                      registrarse.
                    </p>
                  ) : (
                    <p>
                      Tenía actividad, así que <strong>se ha anonimizado</strong>: sus votos siguen
                      contando en las votaciones ya cerradas y sus comentarios siguen publicados,
                      pero firmados como «Usuario dado de baja». Ya no puede entrar.
                    </p>
                  )}
                  {hecho.fiscal && (
                    <p className="rounded-boton bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
                      Llegó a pagar cuota, así que <strong>se conservan su NIF y los datos de
                      Stripe</strong> por obligación tributaria (Modelo 182, LO 8/2007). No es un
                      olvido: no se pueden borrar hasta que prescriba el plazo.
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <p className="mt-2 text-[14px] text-cuerpo">
                    Se le corta el acceso y su perfil se vacía de datos personales. Si tiene votos o
                    comentarios, <strong>se conservan sin su nombre</strong> — un voto ya emitido
                    sigue contando en su votación. Si no ha dejado rastro, la cuenta se borra del
                    todo.
                  </p>

                  <label className="mt-4 flex items-start gap-2 text-[13.5px] text-cuerpo">
                    <input
                      type="checkbox"
                      checked={entendido}
                      onChange={(e) => setEntendido(e.target.checked)}
                      disabled={pendiente}
                      className="mt-0.5 h-4 w-4 accent-red-600"
                    />
                    <span>Entiendo que esta acción no se puede deshacer.</span>
                  </label>
                </>
              )}

              {error && (
                <p className="mt-3 rounded-boton bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-700">
                  {error}
                </p>
              )}

              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={cerrar}
                  disabled={pendiente}
                  className="rounded-boton border border-linea bg-white px-4 py-2 text-[14px] font-bold text-titular hover:border-titular disabled:opacity-50"
                >
                  {hecho ? 'Cerrar' : 'Cancelar'}
                </button>
                {!hecho && (
                  <button
                    type="button"
                    onClick={confirmar}
                    disabled={pendiente || !entendido}
                    className="rounded-boton bg-red-600 px-4 py-2 text-[14px] font-bold text-white transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {pendiente ? 'Dando de baja…' : 'Dar de baja'}
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
