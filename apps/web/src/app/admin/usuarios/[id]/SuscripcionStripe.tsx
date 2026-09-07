'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  pausarCuotaAction,
  reanudarCuotaAction,
  cancelarCuotaAction,
  type ResultadoSuscripcion,
} from './suscripcion-actions';

/**
 * Gestión de la suscripción sin entrar en Stripe.
 *
 * Se opera contra Stripe y el estado lo espeja después el webhook: por eso
 * tras cada acción se refresca la página en vez de pintar el nuevo estado a
 * mano. Si el webhook tardara, se verá el estado anterior un instante — es
 * preferible a inventarse un estado que quizá Stripe no aceptó.
 */
export function SuscripcionStripe({
  userId,
  estado,
  subscriptionId,
  customerId,
}: {
  userId: string;
  estado: string | null;
  subscriptionId: string | null;
  customerId: string | null;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<ResultadoSuscripcion | null>(null);
  const [confirmando, setConfirmando] = useState<'cancelar' | null>(null);

  function correr(fn: () => Promise<ResultadoSuscripcion>) {
    setAviso(null);
    iniciar(async () => {
      const r = await fn();
      setAviso(r);
      setConfirmando(null);
      if (r.ok) router.refresh();
    });
  }

  if (!subscriptionId) {
    return (
      <p className="text-[13px] text-gris">
        Sin suscripción de Stripe asociada. Las acciones de cuota aparecen cuando existe una.
      </p>
    );
  }

  const panelStripe = `https://dashboard.stripe.com/${subscriptionId.startsWith('sub_') ? '' : 'test/'}subscriptions/${subscriptionId}`;

  return (
    <div className="space-y-3">
      <dl className="grid gap-1 text-[12.5px]">
        <div className="flex gap-2">
          <dt className="text-gris">Suscripción:</dt>
          <dd className="font-mono text-cuerpo">{subscriptionId}</dd>
        </div>
        {customerId && (
          <div className="flex gap-2">
            <dt className="text-gris">Cliente:</dt>
            <dd className="font-mono text-cuerpo">{customerId}</dd>
          </div>
        )}
      </dl>

      {aviso && (
        <p
          className={`rounded-boton px-3.5 py-2.5 text-[13px] font-medium ${aviso.ok ? 'bg-teal/10 text-titular' : 'bg-magenta/10 text-magenta'}`}
        >
          {aviso.ok ? aviso.mensaje : aviso.error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {estado === 'paused' ? (
          <button
            type="button"
            disabled={pendiente}
            onClick={() => correr(() => reanudarCuotaAction(userId))}
            className="rounded-boton bg-accion px-4 py-2 text-[13px] font-bold text-white shadow-boton disabled:opacity-50"
          >
            {pendiente ? 'Reanudando…' : 'Reanudar cuota'}
          </button>
        ) : (
          <button
            type="button"
            disabled={pendiente || estado === 'canceled'}
            onClick={() => correr(() => pausarCuotaAction(userId))}
            className="rounded-boton border border-linea bg-white px-4 py-2 text-[13px] font-bold text-titular hover:border-titular disabled:opacity-50"
          >
            {pendiente ? 'Pausando…' : 'Pausar cuota'}
          </button>
        )}

        {confirmando === 'cancelar' ? (
          <span className="flex flex-wrap items-center gap-2 rounded-boton bg-magenta/10 px-3 py-2 text-[12.5px] text-magenta">
            ¿Cancelar al final del periodo pagado?
            <button
              type="button"
              disabled={pendiente}
              onClick={() => correr(() => cancelarCuotaAction(userId))}
              className="rounded-boton bg-magenta px-3 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-50"
            >
              Sí, cancelar
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(null)}
              className="font-bold underline"
            >
              No
            </button>
          </span>
        ) : (
          <button
            type="button"
            disabled={pendiente || estado === 'canceled'}
            onClick={() => setConfirmando('cancelar')}
            className="rounded-boton border border-linea bg-white px-4 py-2 text-[13px] font-bold text-cuerpo hover:border-magenta hover:text-magenta disabled:opacity-50"
          >
            Cancelar cuota
          </button>
        )}

        <a
          href={panelStripe}
          target="_blank"
          rel="noreferrer"
          className="rounded-boton border border-linea bg-white px-4 py-2 text-[13px] font-bold text-titular no-underline hover:border-titular"
        >
          Abrir en Stripe ↗
        </a>
      </div>

      <p className="text-[12px] text-gris">
        Pausar no da de baja: la persona conserva su condición de socio y sus derechos de voto, y
        no se le acumulan cuotas atrasadas. Cancelar surte efecto al terminar el periodo ya pagado.
      </p>
    </div>
  );
}
