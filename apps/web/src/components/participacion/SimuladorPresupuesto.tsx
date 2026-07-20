'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { guardarEscenarioAction } from '@/app/presupuestos/actions';
import type { Ministry } from '@/lib/participacion/types';

function euros(cents: number): string {
  return (cents / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

/** Deslizadores por ministerio partiendo del PGE real, con desviación en vivo y nota "qué paga esto". */
export function SimuladorPresupuesto({ ministerios }: { ministerios: Ministry[] }) {
  const totalPGE = useMemo(() => ministerios.reduce((acc, m) => acc + m.current_budget_cents, 0), [ministerios]);

  const [pct, setPct] = useState<Record<number, number>>(() =>
    Object.fromEntries(ministerios.map((m) => [m.id, 100])),
  );
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [idGuardado, setIdGuardado] = useState<string | null>(null);
  const [pendiente, iniciarTransicion] = useTransition();
  const router = useRouter();

  const asignaciones = useMemo(
    () =>
      Object.fromEntries(
        ministerios.map((m) => [m.id, Math.round((m.current_budget_cents * pct[m.id]) / 100)]),
      ),
    [ministerios, pct],
  );

  const totalMio = Object.values(asignaciones).reduce((acc: number, v) => acc + (v as number), 0);
  const desviacion = totalMio - totalPGE;
  const desviacionPct = totalPGE > 0 ? (desviacion / totalPGE) * 100 : 0;

  function guardar() {
    iniciarTransicion(async () => {
      const allocationParaGuardar = Object.fromEntries(
        Object.entries(asignaciones).map(([id, cents]) => [id, cents]),
      );
      const resultado = await guardarEscenarioAction(allocationParaGuardar);
      setMensaje(resultado.mensaje);
      if (resultado.ok && resultado.id) setIdGuardado(resultado.id);
    });
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-4 z-10 rounded-tarjeta border-2 border-titular bg-panel p-5 shadow-nav">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[.05em] text-gris">Tu presupuesto total</p>
            <p className="text-[24px] font-extrabold text-titular">{euros(totalMio)}</p>
          </div>
          <div className="text-right">
            <p className="text-[12px] font-bold uppercase tracking-[.05em] text-gris">Desviación vs PGE real</p>
            <p className={`text-[22px] font-extrabold ${desviacion === 0 ? 'text-cat-agricultura' : desviacion > 0 ? 'text-cat-sanidad' : 'text-cat-transparencia'}`}>
              {desviacion > 0 ? '+' : ''}
              {euros(desviacion)} ({desviacionPct > 0 ? '+' : ''}
              {desviacionPct.toFixed(1)}%)
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {ministerios.map((m) => (
          <div key={m.id} className="rounded-tarjeta border border-linea bg-panel p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[15px] font-bold text-titular">{m.name}</h3>
              <span className="text-[13.5px] font-semibold text-cuerpo">
                {euros(asignaciones[m.id] as number)} ({pct[m.id]}%)
              </span>
            </div>
            {m.note && <p className="mt-1 text-[12.5px] text-gris">💡 {m.note}</p>}
            <input
              type="range"
              min={0}
              max={200}
              step={5}
              value={pct[m.id]}
              onChange={(e) => setPct((prev) => ({ ...prev, [m.id]: Number(e.target.value) }))}
              className="mt-3 w-full accent-[var(--color-accion,#16B8A0)]"
            />
            <p className="mt-1 text-[11.5px] text-gris">PGE actual: {euros(m.current_budget_cents)}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={pendiente}
          onClick={guardar}
          className="rounded-boton bg-accion px-6 py-3 text-[14px] font-bold text-white shadow-boton disabled:opacity-60"
        >
          {pendiente ? 'Guardando…' : 'Guardar mi escenario'}
        </button>
        {idGuardado && (
          <button
            type="button"
            onClick={() => router.push(`/presupuestos/${idGuardado}`)}
            className="rounded-boton border border-linea bg-white px-5 py-2.5 text-[13.5px] font-bold text-titular hover:border-titular"
          >
            Ver tarjeta compartible →
          </button>
        )}
        {mensaje && <p className="text-[13.5px] font-semibold text-titular">{mensaje}</p>}
      </div>
    </div>
  );
}
