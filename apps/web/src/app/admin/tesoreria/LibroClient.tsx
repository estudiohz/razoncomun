'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  crearMovimientoAction,
  editarMovimientoAction,
  publicarMovimientoAction,
} from './actions';
import type { Movimiento } from '@/lib/tesoreria/movimientos';

function euros(cents: number): string {
  return (cents / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
}
function fecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Libro tipo extracto bancario (T2). Sin botón de borrar: la BD tampoco lo
 * permite desde 0035. Editar sirve para corregir y sobre todo para anonimizar.
 */
export function LibroClient({
  movimientos,
  categorias,
  puedeEditar,
}: {
  movimientos: Movimiento[];
  categorias: string[];
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [nuevoAbierto, setNuevoAbierto] = useState(false);
  const [editando, setEditando] = useState<Movimiento | null>(null);

  function ejecutar(fn: () => Promise<{ ok: boolean; error?: string }>, alTerminar?: () => void) {
    setError(null);
    iniciar(async () => {
      const r = await fn();
      if (!r.ok) {
        setError(r.error ?? 'No se ha podido completar la operación.');
        return;
      }
      alTerminar?.();
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* Aviso permanente: la regla de transparencia, escrita donde se opera. */}
      <div className="rounded-tarjeta border border-teal/40 bg-teal/[.06] px-5 py-4 text-[13.5px] text-cuerpo">
        <p className="font-bold text-titular">Aquí no se elimina nada.</p>
        <p className="mt-1">
          Un movimiento no se puede borrar: la base de datos no lo permite, no es solo que falte el
          botón. Si algo está mal, se corrige y queda registrado quién lo cambió y cuándo. Las
          correcciones se marcan como tales también en la página pública de cuentas.
        </p>
        <p className="mt-1">
          Sí se pueden <strong>quitar nombres de particulares</strong> antes de publicar: es una
          obligación de protección de datos, y el importe y la fecha se conservan intactos.
        </p>
      </div>

      {error && (
        <p className="rounded-boton bg-magenta/10 px-3.5 py-2.5 text-[13px] font-medium text-magenta">
          {error}
        </p>
      )}

      {puedeEditar && (
        <div>
          <button
            type="button"
            onClick={() => setNuevoAbierto((v) => !v)}
            className="rounded-boton bg-accion px-4 py-2.5 text-[13px] font-bold text-white shadow-boton"
          >
            {nuevoAbierto ? 'Cancelar' : '+ Añadir movimiento manual'}
          </button>

          {nuevoAbierto && (
            <form
              action={(fd) => ejecutar(() => crearMovimientoAction(fd), () => setNuevoAbierto(false))}
              className="mt-3 grid gap-3 rounded-tarjeta border border-linea bg-panel p-5 min-[720px]:grid-cols-5"
            >
              <label className="text-[12px] font-bold text-gris">
                Fecha
                <input type="date" name="dated" required className="mt-1 w-full rounded-boton border border-linea px-3 py-2 text-[14px] font-normal text-cuerpo" />
              </label>
              <label className="text-[12px] font-bold text-gris min-[720px]:col-span-2">
                Concepto
                <input name="description" required maxLength={200} className="mt-1 w-full rounded-boton border border-linea px-3 py-2 text-[14px] font-normal text-cuerpo" />
              </label>
              <label className="text-[12px] font-bold text-gris">
                Importe (€)
                <input name="amount" required inputMode="decimal" placeholder="0,00" className="mt-1 w-full rounded-boton border border-linea px-3 py-2 text-[14px] font-normal text-cuerpo" />
              </label>
              <label className="text-[12px] font-bold text-gris">
                Tipo
                <select name="direction" required className="mt-1 w-full rounded-boton border border-linea px-3 py-2 text-[14px] font-normal text-cuerpo">
                  <option value="out">Gasto</option>
                  <option value="in">Ingreso</option>
                </select>
              </label>
              <label className="text-[12px] font-bold text-gris min-[720px]:col-span-2">
                Categoría
                <input name="category" list="cats-tesoreria" className="mt-1 w-full rounded-boton border border-linea px-3 py-2 text-[14px] font-normal text-cuerpo" />
                <datalist id="cats-tesoreria">
                  {categorias.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </label>
              <div className="flex items-end min-[720px]:col-span-3">
                <button
                  type="submit"
                  disabled={pendiente}
                  className="rounded-boton bg-accion px-5 py-2.5 text-[13px] font-bold text-white shadow-boton disabled:opacity-50"
                >
                  {pendiente ? 'Guardando…' : 'Añadir'}
                </button>
                <p className="ml-3 text-[12px] text-gris">
                  Entra sin publicar: no aparece en /cuentas hasta que lo publiques.
                </p>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-tarjeta border border-linea bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-[13.5px]">
            <thead className="bg-fondo text-[12px] font-bold uppercase tracking-wide text-gris">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Concepto</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3">Contraparte</th>
                <th className="px-4 py-3 text-right">Importe</th>
                <th className="px-4 py-3">En /cuentas</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {movimientos.map((m) => (
                <tr key={m.id} className="border-t border-linea/60 align-top">
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums text-cuerpo">{fecha(m.dated)}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-titular">{m.description}</p>
                    {m.edited_at && (
                      <p className="mt-0.5 text-[11.5px] text-gris">Corregido el {fecha(m.edited_at)}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[12.5px] text-cuerpo">{m.category ?? '—'}</td>
                  <td className="px-4 py-3 text-[12.5px] text-gris">
                    {m.counterparty_name ?? <span className="italic">anonimizada</span>}
                  </td>
                  <td
                    className={`whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums ${m.direction === 'in' ? 'text-titular' : 'text-magenta'}`}
                  >
                    {m.direction === 'in' ? '+' : '−'}
                    {euros(m.amount_cents)}
                  </td>
                  <td className="px-4 py-3">
                    {puedeEditar ? (
                      <button
                        type="button"
                        disabled={pendiente}
                        onClick={() => ejecutar(() => publicarMovimientoAction(m.id, !m.published))}
                        className={`rounded-full px-2.5 py-1 text-[11.5px] font-bold ${m.published ? 'bg-teal/15 text-titular' : 'bg-fondo text-gris'}`}
                      >
                        {m.published ? 'Publicado' : 'Sin publicar'}
                      </button>
                    ) : (
                      <span className="text-[12px] text-gris">{m.published ? 'Sí' : 'No'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {puedeEditar && (
                      <button
                        type="button"
                        onClick={() => setEditando(m)}
                        className="rounded-boton border border-linea bg-white px-3 py-1.5 text-[12.5px] font-bold text-titular hover:border-titular"
                      >
                        Corregir
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {movimientos.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gris">
                    No hay movimientos con este filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editando && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-[520px] rounded-tarjeta border border-linea bg-white p-6 shadow-tarjeta">
            <h2 className="text-[17px] font-extrabold text-titular">Corregir movimiento</h2>
            <p className="mt-1 text-[12.5px] text-gris">
              {fecha(editando.dated)} · {euros(editando.amount_cents)} · la fecha y el importe no se
              tocan: son el dato contable.
            </p>
            <form
              action={(fd) =>
                ejecutar(() => editarMovimientoAction(editando.id, fd), () => setEditando(null))
              }
              className="mt-4 space-y-3"
            >
              <label className="block text-[12px] font-bold text-gris">
                Concepto
                <input
                  name="description"
                  required
                  defaultValue={editando.description}
                  maxLength={200}
                  className="mt-1 w-full rounded-boton border border-linea px-3 py-2 text-[14px] font-normal text-cuerpo"
                />
              </label>
              <label className="block text-[12px] font-bold text-gris">
                Categoría
                <input
                  name="category"
                  defaultValue={editando.category ?? ''}
                  list="cats-tesoreria"
                  className="mt-1 w-full rounded-boton border border-linea px-3 py-2 text-[14px] font-normal text-cuerpo"
                />
              </label>
              <label className="flex items-start gap-2 text-[13px] text-cuerpo">
                <input type="checkbox" name="anonimizar" className="mt-0.5" />
                <span>
                  Anonimizar la contraparte (borra nombre y referencia bancaria). Úsalo antes de
                  publicar un movimiento de un particular.
                </span>
              </label>
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={pendiente}
                  className="rounded-boton bg-accion px-5 py-2.5 text-[13px] font-bold text-white shadow-boton disabled:opacity-50"
                >
                  {pendiente ? 'Guardando…' : 'Guardar corrección'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditando(null)}
                  className="rounded-boton border border-linea bg-white px-5 py-2.5 text-[13px] font-bold text-cuerpo"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
