'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { GraficoRC } from './GraficoRC';
import type { FilaGrafico, GraficoSpec, TipoGrafico } from '@/lib/brain/tipos';

// Editor de gráficos/tablas de una entrada del cerebro. El admin NO escribe
// JSON: rellena filas (etiqueta + valor) en una tablita y ve el resultado en
// vivo. Serializa a un <input hidden name="charts"> que recoge la Server Action
// guardarEntrada. Los datos numéricos son de autoría humana (nunca de la IA).

const etiqueta = 'mb-1 block text-[12px] font-bold uppercase tracking-[.06em] text-gris';
const areaTexto =
  'w-full rounded-boton border border-linea bg-white px-3 py-2 text-[14px] text-cuerpo placeholder:text-gris focus:border-titular focus:outline-none focus:ring-2 focus:ring-titular/20';

function graficoVacio(): GraficoSpec {
  return { type: 'bar', title: '', unit: '', note: '', data: [{ label: '', value: 0 }] };
}

/** Deja solo los gráficos/filas con etiqueta -> lo que se guarda de verdad. */
function limpiar(graficos: GraficoSpec[]): GraficoSpec[] {
  return graficos
    .map((g) => ({ ...g, data: g.data.filter((f) => f.label.trim() !== '') }))
    .filter((g) => g.data.length > 0);
}

export function EditorGraficos({ inicial }: { inicial: GraficoSpec[] }) {
  const [graficos, setGraficos] = useState<GraficoSpec[]>(
    inicial && inicial.length ? inicial : [],
  );

  function actualizar(i: number, cambios: Partial<GraficoSpec>) {
    setGraficos((prev) => prev.map((g, idx) => (idx === i ? { ...g, ...cambios } : g)));
  }
  function eliminarGrafico(i: number) {
    setGraficos((prev) => prev.filter((_, idx) => idx !== i));
  }
  function actualizarFila(gi: number, fi: number, cambios: Partial<FilaGrafico>) {
    setGraficos((prev) =>
      prev.map((g, idx) =>
        idx === gi ? { ...g, data: g.data.map((f, j) => (j === fi ? { ...f, ...cambios } : f)) } : g,
      ),
    );
  }
  function anadirFila(gi: number) {
    setGraficos((prev) =>
      prev.map((g, idx) => (idx === gi ? { ...g, data: [...g.data, { label: '', value: 0 }] } : g)),
    );
  }
  function eliminarFila(gi: number, fi: number) {
    setGraficos((prev) =>
      prev.map((g, idx) => (idx === gi ? { ...g, data: g.data.filter((_, j) => j !== fi) } : g)),
    );
  }

  const json = JSON.stringify(limpiar(graficos));

  return (
    <div className="mb-6">
      <input type="hidden" name="charts" value={json} />

      <div className="mb-2 flex items-center justify-between">
        <label className="text-[13px] font-bold uppercase tracking-[.08em] text-gris">
          Gráficos y tablas
        </label>
        <button
          type="button"
          onClick={() => setGraficos((prev) => [...prev, graficoVacio()])}
          className="rounded-full border border-linea px-4 py-1.5 text-[13px] font-bold text-titular hover:border-titular"
        >
          + Añadir gráfico o tabla
        </button>
      </div>
      <p className="mb-3 text-[12.5px] text-gris">
        Rellena los datos a mano (etiqueta + valor). El chat los mostrará cuando la respuesta use
        esta entrada. Los números los pones tú, nunca la IA.
      </p>

      {graficos.length === 0 ? (
        <p className="rounded-boton border border-dashed border-linea bg-fondo px-4 py-5 text-center text-[13px] text-gris">
          Sin gráficos. Añade uno si esta entrada tiene datos que se vean mejor en barras o tabla
          (p. ej. la cuota de autónomos por tramos).
        </p>
      ) : (
        <div className="space-y-5">
          {graficos.map((g, gi) => {
            const previa: GraficoSpec = { ...g, data: g.data.filter((f) => f.label.trim() !== '') };
            return (
              <div key={gi} className="rounded-tarjeta border border-linea bg-white p-4">
                <div className="mb-3 flex flex-wrap items-end gap-3">
                  <div>
                    <label className={etiqueta}>Tipo</label>
                    <select
                      value={g.type}
                      onChange={(e) => actualizar(gi, { type: e.target.value as TipoGrafico })}
                      className={areaTexto}
                    >
                      <option value="bar">Barras</option>
                      <option value="table">Tabla</option>
                    </select>
                  </div>
                  <div className="min-w-[180px] flex-1">
                    <label className={etiqueta}>Título</label>
                    <Input
                      value={g.title}
                      onChange={(e) => actualizar(gi, { title: e.target.value })}
                      placeholder="Cuota de autónomos por tramo de ingresos"
                    />
                  </div>
                  <div className="w-[120px]">
                    <label className={etiqueta}>Unidad</label>
                    <Input
                      value={g.unit ?? ''}
                      onChange={(e) => actualizar(gi, { unit: e.target.value })}
                      placeholder="€/mes"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => eliminarGrafico(gi)}
                    className="rounded-boton border border-red-300 px-3 py-2 text-[12.5px] font-bold text-red-600 hover:bg-red-50"
                  >
                    Quitar
                  </button>
                </div>

                <div className="mb-3">
                  <label className={etiqueta}>Aclaración (opcional)</label>
                  <Input
                    value={g.note ?? ''}
                    onChange={(e) => actualizar(gi, { note: e.target.value })}
                    placeholder="Cuota Cero hasta cubrir gastos; progresiva a partir de ahí"
                  />
                </div>

                <label className={etiqueta}>Datos</label>
                <div className="space-y-2">
                  {g.data.map((fila, fi) => (
                    <div key={fi} className="flex items-center gap-2">
                      <Input
                        className="flex-1"
                        value={fila.label}
                        onChange={(e) => actualizarFila(gi, fi, { label: e.target.value })}
                        placeholder="Tramo / etiqueta (p. ej. 670–900 €)"
                      />
                      <input
                        type="number"
                        inputMode="decimal"
                        value={Number.isFinite(fila.value) ? fila.value : 0}
                        onChange={(e) => actualizarFila(gi, fi, { value: Number(e.target.value) || 0 })}
                        className={`${areaTexto} w-[120px] text-right`}
                        placeholder="0"
                      />
                      <button
                        type="button"
                        onClick={() => eliminarFila(gi, fi)}
                        aria-label="Quitar fila"
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-boton border border-linea text-gris hover:border-red-300 hover:text-red-600"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => anadirFila(gi)}
                  className="mt-2 rounded-full border border-linea px-3 py-1 text-[12.5px] font-bold text-titular hover:border-titular"
                >
                  + Añadir fila
                </button>

                {previa.data.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 text-[11.5px] font-bold uppercase tracking-[.06em] text-gris">
                      Vista previa
                    </p>
                    <GraficoRC spec={previa} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
