'use client';

import { useState, useTransition } from 'react';
import { emitirVotoAction } from '@/app/votaciones/actions';
import { ETIQUETA_ELECCION, type EleccionVoto } from '@/lib/participacion/types';
import { cn } from '@/lib/cn';

const OPCIONES: EleccionVoto[] = ['favor', 'contra', 'abstencion'];

/**
 * Formulario de emisión de voto. D-001 (decisiones-construccion.md): el aviso
 * de publicidad nominal es IMBORRABLE — se muestra siempre, no en un modal
 * descartable, y el botón de enviar queda deshabilitado hasta que la persona
 * marca la casilla de confirmación explícita.
 */
export function VotoForm({ voteId, esVinculante }: { voteId: string; esVinculante: boolean }) {
  const [eleccion, setEleccion] = useState<EleccionVoto | null>(null);
  const [confirmado, setConfirmado] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [pendiente, iniciarTransicion] = useTransition();

  function enviar() {
    if (!eleccion) return;
    iniciarTransicion(async () => {
      const resultado = await emitirVotoAction(voteId, eleccion, confirmado);
      setMensaje(resultado.mensaje);
    });
  }

  return (
    <div className="rounded-tarjeta border-2 border-titular bg-panel p-6">
      <div className="rounded-boton border-2 border-cat-sanidad bg-cat-sanidad/10 p-4">
        <p className="text-[14px] font-extrabold text-titular">
          ⚠️ Tu voto será público con tu nombre.
        </p>
        <p className="mt-1 text-[13px] text-cuerpo">
          Razón Común aplica el voto público nominal: cualquier persona podrá ver en la página de
          resultados que tú, con tu nombre visible, votaste esta opción. No es anónimo ni
          seudonimizado.
        </p>
      </div>

      <p className="mt-5 text-[13.5px] font-semibold text-titular">
        Tu voto será {esVinculante ? 'vinculante' : 'consultivo'}
        {!esVinculante && (
          <span className="ml-1.5 font-normal text-gris">
            (no cumples los requisitos de afiliación para voto vinculante en esta votación)
          </span>
        )}
      </p>

      <div className="mt-3 flex flex-wrap gap-2.5">
        {OPCIONES.map((opcion) => (
          <button
            key={opcion}
            type="button"
            onClick={() => setEleccion(opcion)}
            className={cn(
              'rounded-boton border-2 px-5 py-2.5 text-[14px] font-bold transition-colors',
              eleccion === opcion ? 'border-accion bg-accion text-white' : 'border-linea bg-white text-titular hover:border-titular',
            )}
          >
            {ETIQUETA_ELECCION[opcion]}
          </button>
        ))}
      </div>

      <label className="mt-5 flex items-start gap-2.5 text-[13.5px] text-cuerpo">
        <input
          type="checkbox"
          checked={confirmado}
          onChange={(e) => setConfirmado(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-linea text-accion"
        />
        He leído y entiendo que mi voto será público, visible con mi nombre, en la página de
        resultados de esta votación.
      </label>

      <button
        type="button"
        disabled={!eleccion || !confirmado || pendiente}
        onClick={enviar}
        className="mt-4 rounded-boton bg-accion px-6 py-3 text-[14px] font-bold text-white shadow-boton disabled:opacity-50"
      >
        {pendiente ? 'Emitiendo…' : 'Emitir mi voto'}
      </button>

      {mensaje && (
        <p className="mt-3 text-[13.5px] font-semibold text-titular" role="status">
          {mensaje}
        </p>
      )}
    </div>
  );
}
