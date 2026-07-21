'use client';

/**
 * app/admin/presupuesto/DemografiaClient.tsx
 *
 * CRUD de `sim_demografia` (D-S12, docs/tecnico/simulador-pais.md §9).
 * Componente compartido entre dos contextos, que solo se distinguen por
 * `areaId`:
 *   - `areaId = raizId` — profesionales de un sector, embebido dentro de
 *     `AreaEditorClient` (editor de la partida raíz correspondiente).
 *   - `areaId = null` — "Población de España" (panel general), montado en
 *     `/admin/presupuesto/poblacion`.
 * Mismo patrón de fila-editable que `ParametrosClient`/`AreaEditorClient`
 * (abrir/cerrar, publicar, borrar, previsualización nula porque estas filas
 * no alimentan el motor — son informativas, D-S13).
 */

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { cn } from '@/lib/cn';
import type { DemografiaRow } from '@/lib/simulador/adminData';
import {
  eliminarDemografiaAction,
  guardarDemografiaAction,
  publicarDemografiaAction,
} from '@/lib/simulador/adminActions';
import { formatoEurosConUnidad, formatoPersonas } from '@/lib/simulador/formato';

interface Campos {
  nombre: string;
  num_personas: string;
  valor_medio_euros: string;
  unidad_valor_medio: string;
  fuente: string;
  anio: string;
  orden: string;
}

const VACIO: Campos = {
  nombre: '',
  num_personas: '',
  valor_medio_euros: '',
  unidad_valor_medio: '',
  fuente: '',
  anio: '2026',
  orden: '0',
};

function camposDesde(f: DemografiaRow): Campos {
  return {
    nombre: f.nombre,
    num_personas: String(f.num_personas),
    valor_medio_euros: f.valor_medio_cents !== null ? String(f.valor_medio_cents / 100) : '',
    unidad_valor_medio: f.unidad_valor_medio ?? '',
    fuente: f.fuente ?? '',
    anio: String(f.anio),
    orden: String(f.orden),
  };
}

function aFormData(id: string | null, areaId: string | null, c: Campos): FormData {
  const fd = new FormData();
  if (id) fd.set('id', id);
  fd.set('area_id', areaId ?? '');
  fd.set('nombre', c.nombre);
  fd.set('num_personas', c.num_personas);
  fd.set('valor_medio_euros', c.valor_medio_euros);
  fd.set('unidad_valor_medio', c.unidad_valor_medio);
  fd.set('fuente', c.fuente);
  fd.set('anio', c.anio);
  fd.set('orden', c.orden);
  return fd;
}

function Formulario({ campos, onCambio }: { campos: Campos; onCambio: (c: Campos) => void }) {
  const set = <K extends keyof Campos>(k: K, v: Campos[K]) => onCambio({ ...campos, [k]: v });

  return (
    <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2">
      <label className="block text-[12.5px] font-semibold text-gris">
        Nombre
        <input
          value={campos.nombre}
          onChange={(e) => set('nombre', e.target.value)}
          placeholder="Jubilados, Médicos, Tropa y mando…"
          className="mt-1 w-full rounded-boton border border-linea px-3 py-2 text-[14px]"
        />
      </label>
      <label className="block text-[12.5px] font-semibold text-gris">
        Nº de personas
        <input
          type="number"
          min={0}
          step="1"
          value={campos.num_personas}
          onChange={(e) => set('num_personas', e.target.value)}
          className="mt-1 w-full rounded-boton border border-linea px-3 py-2 text-[14px]"
        />
      </label>
      <label className="block text-[12.5px] font-semibold text-gris">
        Valor medio (€, opcional — sueldo, pensión…)
        <input
          type="number"
          step="0.01"
          value={campos.valor_medio_euros}
          onChange={(e) => set('valor_medio_euros', e.target.value)}
          className="mt-1 w-full rounded-boton border border-linea px-3 py-2 text-[14px]"
        />
      </label>
      <label className="block text-[12.5px] font-semibold text-gris">
        Unidad del valor medio
        <input
          value={campos.unidad_valor_medio}
          onChange={(e) => set('unidad_valor_medio', e.target.value)}
          placeholder="€/mes, €/año…"
          className="mt-1 w-full rounded-boton border border-linea px-3 py-2 text-[14px]"
        />
      </label>
      <label className="block text-[12.5px] font-semibold text-gris min-[640px]:col-span-2">
        Fuente
        <input
          value={campos.fuente}
          onChange={(e) => set('fuente', e.target.value)}
          placeholder="INE, Seguridad Social, Ministerio de Defensa…"
          className="mt-1 w-full rounded-boton border border-linea px-3 py-2 text-[13.5px]"
        />
      </label>
      <label className="block text-[12.5px] font-semibold text-gris">
        Año
        <input
          type="number"
          value={campos.anio}
          onChange={(e) => set('anio', e.target.value)}
          className="mt-1 w-full rounded-boton border border-linea px-3 py-2 text-[14px]"
        />
      </label>
      <label className="block text-[12.5px] font-semibold text-gris">
        Orden
        <input
          type="number"
          value={campos.orden}
          onChange={(e) => set('orden', e.target.value)}
          className="mt-1 w-full rounded-boton border border-linea px-3 py-2 text-[14px]"
        />
      </label>
    </div>
  );
}

function FilaExistente({
  fila,
  areaId,
  onGuardado,
}: {
  fila: DemografiaRow;
  areaId: string | null;
  onGuardado: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [campos, setCampos] = useState(() => camposDesde(fila));
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function guardar() {
    setError(null);
    iniciar(async () => {
      const r = await guardarDemografiaAction(aFormData(fila.id, areaId, campos));
      if (!r.ok) {
        setError(r.error ?? 'No se ha podido guardar.');
        return;
      }
      setAbierto(false);
      onGuardado();
    });
  }

  function borrar() {
    if (!confirm(`¿Borrar "${fila.nombre}"? Esta acción no se puede deshacer.`)) return;
    setError(null);
    iniciar(async () => {
      const r = await eliminarDemografiaAction(fila.id, areaId);
      if (!r.ok) {
        setError(r.error ?? 'No se ha podido borrar.');
        return;
      }
      onGuardado();
    });
  }

  function publicar(valor: boolean) {
    setError(null);
    iniciar(async () => {
      const r = await publicarDemografiaAction(fila.id, areaId, valor);
      if (!r.ok) {
        setError(r.error ?? 'No se ha podido cambiar la publicación.');
        return;
      }
      onGuardado();
    });
  }

  return (
    <div className="rounded-boton border border-linea bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-bold text-titular">{fila.nombre}</p>
          <p className="text-[12.5px] text-gris">
            {formatoPersonas(fila.num_personas)}
            {fila.valor_medio_cents !== null && (
              <> · {formatoEurosConUnidad(fila.valor_medio_cents, fila.unidad_valor_medio)}</>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 text-[11px] font-bold',
              fila.publicado ? 'bg-accion/10 text-accion' : 'bg-gris/15 text-gris',
            )}
          >
            {fila.publicado ? 'Publicado' : 'Borrador'}
          </span>
          <button
            type="button"
            onClick={() => publicar(!fila.publicado)}
            disabled={pendiente}
            className="rounded-boton border border-linea bg-white px-3 py-1.5 text-[12.5px] font-bold text-titular hover:border-titular disabled:opacity-50"
          >
            {fila.publicado ? 'Despublicar' : 'Publicar'}
          </button>
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            className="rounded-boton bg-fondo px-3 py-1.5 text-[12.5px] font-bold text-titular"
          >
            {abierto ? 'Cerrar' : 'Editar'}
          </button>
          <button
            type="button"
            onClick={borrar}
            disabled={pendiente}
            className="rounded-boton border border-magenta/40 bg-white px-3 py-1.5 text-[12.5px] font-bold text-magenta hover:bg-magenta/5 disabled:opacity-50"
          >
            Borrar
          </button>
        </div>
      </div>

      {abierto && (
        <div className="mt-4 border-t border-linea pt-4">
          <Formulario campos={campos} onCambio={setCampos} />
          {error && <p className="mt-3 text-[13px] font-semibold text-magenta">{error}</p>}
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={guardar}
              disabled={pendiente}
              className="rounded-boton bg-accion px-5 py-2 text-[13.5px] font-bold text-white shadow-boton disabled:opacity-60"
            >
              {pendiente ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function DemografiaClient({ areaId, filas }: { areaId: string | null; filas: DemografiaRow[] }) {
  const router = useRouter();
  const [creando, setCreando] = useState(false);
  const [campos, setCampos] = useState<Campos>(VACIO);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function refrescar() {
    router.refresh();
  }

  function crear() {
    setError(null);
    if (!campos.nombre.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    iniciar(async () => {
      const r = await guardarDemografiaAction(aFormData(null, areaId, campos));
      if (!r.ok) {
        setError(r.error ?? 'No se ha podido crear.');
        return;
      }
      setCreando(false);
      setCampos(VACIO);
      refrescar();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[13.5px] text-cuerpo">{filas.length} fila{filas.length === 1 ? '' : 's'}.</p>
        <button
          type="button"
          onClick={() => setCreando((v) => !v)}
          className="rounded-boton border border-linea bg-white px-4 py-2 text-[13px] font-bold text-titular hover:border-titular"
        >
          {creando ? 'Cancelar' : '+ Nueva fila'}
        </button>
      </div>

      {creando && (
        <div className="rounded-boton border border-linea bg-fondo p-4">
          <Formulario campos={campos} onCambio={setCampos} />
          {error && <p className="mt-3 text-[13px] font-semibold text-magenta">{error}</p>}
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={crear}
              disabled={pendiente}
              className="rounded-boton bg-accion px-5 py-2 text-[13.5px] font-bold text-white shadow-boton disabled:opacity-60"
            >
              {pendiente ? 'Creando…' : 'Crear fila'}
            </button>
          </div>
        </div>
      )}

      {filas.length === 0 && !creando && (
        <p className="rounded-boton border border-linea bg-white p-6 text-center text-cuerpo">
          Todavía no hay filas.
        </p>
      )}

      <div className="space-y-3">
        {filas.map((f) => (
          <FilaExistente key={f.id} fila={f} areaId={areaId} onGuardado={refrescar} />
        ))}
      </div>
    </div>
  );
}
