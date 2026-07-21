'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { cn } from '@/lib/cn';
import type { ParametroRow } from '@/lib/simulador/adminData';
import {
  eliminarParametroAction,
  guardarParametroAction,
  publicarParametroAction,
} from '@/lib/simulador/adminActions';
import type { ModoValor } from '@/lib/simulador/tipos';

interface Campos {
  clave: string;
  nombre: string;
  unidad: string;
  modo: ModoValor;
  valor_actual: string;
  formula: string;
  fuente_actual: string;
  /** URL de la fuente oficial que respalda `fuente_actual` (0031). Opcional. */
  fuente_actual_url: string;
  valor_rc: string;
  nota_rc: string;
  es_palanca: boolean;
  palanca_min: string;
  palanca_max: string;
}

function camposDesde(p: ParametroRow): Campos {
  return {
    clave: p.clave,
    nombre: p.nombre,
    unidad: p.unidad ?? '',
    modo: p.modo,
    valor_actual: p.valor_actual !== null ? String(p.valor_actual) : '',
    formula: p.formula ?? '',
    fuente_actual: p.fuente_actual ?? '',
    fuente_actual_url: p.fuente_actual_url ?? '',
    valor_rc: p.valor_rc !== null ? String(p.valor_rc) : '',
    nota_rc: p.nota_rc ?? '',
    es_palanca: p.es_palanca,
    palanca_min: p.palanca_min !== null ? String(p.palanca_min) : '',
    palanca_max: p.palanca_max !== null ? String(p.palanca_max) : '',
  };
}

const VACIO: Campos = {
  clave: '',
  nombre: '',
  unidad: '',
  modo: 'fijo',
  valor_actual: '',
  formula: '',
  fuente_actual: '',
  fuente_actual_url: '',
  valor_rc: '',
  nota_rc: '',
  es_palanca: false,
  palanca_min: '',
  palanca_max: '',
};

function aFormData(id: string | null, c: Campos): FormData {
  const fd = new FormData();
  if (id) fd.set('id', id);
  fd.set('clave', c.clave.trim());
  fd.set('nombre', c.nombre);
  fd.set('unidad', c.unidad);
  fd.set('modo', c.modo);
  fd.set('valor_actual', c.valor_actual);
  fd.set('formula', c.formula);
  fd.set('fuente_actual', c.fuente_actual);
  fd.set('fuente_actual_url', c.fuente_actual_url);
  fd.set('valor_rc', c.valor_rc);
  fd.set('nota_rc', c.nota_rc);
  if (c.es_palanca) fd.set('es_palanca', 'on');
  fd.set('palanca_min', c.palanca_min);
  fd.set('palanca_max', c.palanca_max);
  return fd;
}

function Formulario({
  campos,
  onCambio,
  claveBloqueada,
}: {
  campos: Campos;
  onCambio: (c: Campos) => void;
  claveBloqueada: boolean;
}) {
  const set = <K extends keyof Campos>(k: K, v: Campos[K]) => onCambio({ ...campos, [k]: v });

  return (
    <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2">
      <label className="block text-[12.5px] font-semibold text-gris">
        Clave (slug, usada en fórmulas — no se puede cambiar luego)
        <input
          value={campos.clave}
          disabled={claveBloqueada}
          onChange={(e) => set('clave', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
          placeholder="cuota_media_autonomo"
          className="mt-1 w-full rounded-boton border border-linea px-3 py-2 font-mono text-[13.5px] disabled:bg-fondo disabled:text-gris"
        />
      </label>
      <label className="block text-[12.5px] font-semibold text-gris">
        Nombre
        <input
          value={campos.nombre}
          onChange={(e) => set('nombre', e.target.value)}
          className="mt-1 w-full rounded-boton border border-linea px-3 py-2 text-[14px]"
        />
      </label>
      <label className="block text-[12.5px] font-semibold text-gris">
        Unidad
        <input
          value={campos.unidad}
          onChange={(e) => set('unidad', e.target.value)}
          placeholder="personas, €/año, €…"
          className="mt-1 w-full rounded-boton border border-linea px-3 py-2 text-[14px]"
        />
      </label>
      <label className="block text-[12.5px] font-semibold text-gris">
        Modo
        <select
          value={campos.modo}
          onChange={(e) => set('modo', e.target.value as ModoValor)}
          className="mt-1 w-full rounded-boton border border-linea px-3 py-2 text-[14px]"
        >
          <option value="fijo">Fijo (base)</option>
          <option value="formula">Derivado (elasticidad, D-S2b)</option>
        </select>
      </label>

      {campos.modo === 'fijo' ? (
        <label className="block text-[12.5px] font-semibold text-gris">
          Valor actual
          <input
            type="number"
            step="any"
            value={campos.valor_actual}
            onChange={(e) => set('valor_actual', e.target.value)}
            className="mt-1 w-full rounded-boton border border-linea px-3 py-2 text-[14px]"
          />
        </label>
      ) : (
        <label className="block text-[12.5px] font-semibold text-gris min-[640px]:col-span-2">
          Fórmula (solo referencia otros parámetros)
          <input
            value={campos.formula}
            onChange={(e) => set('formula', e.target.value)}
            placeholder="num_autonomos_base * (1 + 0.4 * (2800 - cuota_media_autonomo) / 2800)"
            className="mt-1 w-full rounded-boton border border-linea px-3 py-2 font-mono text-[13px]"
          />
        </label>
      )}

      <label className="block text-[12.5px] font-semibold text-gris min-[640px]:col-span-2">
        Fuente
        <div className="mt-1 flex flex-col gap-2 min-[720px]:flex-row">
          <input
            value={campos.fuente_actual}
            onChange={(e) => set('fuente_actual', e.target.value)}
            className="flex-1 rounded-boton border border-linea px-3 py-2 text-[13.5px]"
          />
          <input
            type="url"
            placeholder="URL de la fuente (https://...)"
            value={campos.fuente_actual_url}
            onChange={(e) => set('fuente_actual_url', e.target.value)}
            className="flex-1 rounded-boton border border-linea px-3 py-2 text-[13.5px]"
          />
        </div>
      </label>

      {campos.modo === 'fijo' && (
        <>
          <label className="block text-[12.5px] font-semibold text-gris">
            Valor propuesto por RC (opcional)
            <input
              type="number"
              step="any"
              value={campos.valor_rc}
              onChange={(e) => set('valor_rc', e.target.value)}
              className="mt-1 w-full rounded-boton border border-linea px-3 py-2 text-[14px]"
            />
          </label>
          <label className="block text-[12.5px] font-semibold text-gris">
            Nota de RC
            <input
              value={campos.nota_rc}
              onChange={(e) => set('nota_rc', e.target.value)}
              className="mt-1 w-full rounded-boton border border-linea px-3 py-2 text-[13.5px]"
            />
          </label>

          <label className="flex items-center gap-2 text-[13px] font-semibold text-gris">
            <input
              type="checkbox"
              checked={campos.es_palanca}
              onChange={(e) => set('es_palanca', e.target.checked)}
              className="h-4 w-4 accent-accion"
            />
            Es palanca (sandbox público)
          </label>
          {campos.es_palanca && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="any"
                placeholder="Mín"
                value={campos.palanca_min}
                onChange={(e) => set('palanca_min', e.target.value)}
                className="w-28 rounded-boton border border-linea px-3 py-2 text-[13.5px]"
              />
              <span className="text-gris">—</span>
              <input
                type="number"
                step="any"
                placeholder="Máx"
                value={campos.palanca_max}
                onChange={(e) => set('palanca_max', e.target.value)}
                className="w-28 rounded-boton border border-linea px-3 py-2 text-[13.5px]"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FilaParametro({ p, onGuardado }: { p: ParametroRow; onGuardado: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [campos, setCampos] = useState(() => camposDesde(p));
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function guardar() {
    setError(null);
    iniciar(async () => {
      const r = await guardarParametroAction(aFormData(p.id, campos));
      if (!r.ok) {
        setError(r.error ?? 'No se ha podido guardar.');
        return;
      }
      setAbierto(false);
      onGuardado();
    });
  }

  function borrar() {
    if (!confirm(`¿Borrar el parámetro "${p.clave}"?`)) return;
    setError(null);
    iniciar(async () => {
      const r = await eliminarParametroAction(p.id);
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
      const r = await publicarParametroAction(p.id, valor);
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
          <p className="truncate font-bold text-titular">
            {p.nombre} <span className="font-mono text-[12px] font-normal text-gris">({p.clave})</span>
          </p>
          <p className="text-[12.5px] text-gris">
            {p.modo === 'fijo' ? `${p.valor_actual ?? '—'} ${p.unidad ?? ''}` : `Derivado: ${p.formula}`}
            {p.es_palanca && ' · Palanca'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 text-[11px] font-bold',
              p.publicado ? 'bg-accion/10 text-accion' : 'bg-gris/15 text-gris',
            )}
          >
            {p.publicado ? 'Publicado' : 'Borrador'}
          </span>
          <button
            type="button"
            onClick={() => publicar(!p.publicado)}
            disabled={pendiente}
            className="rounded-boton border border-linea bg-white px-3 py-1.5 text-[12.5px] font-bold text-titular hover:border-titular disabled:opacity-50"
          >
            {p.publicado ? 'Despublicar' : 'Publicar'}
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
          <Formulario campos={campos} onCambio={setCampos} claveBloqueada />
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

export function ParametrosClient({ parametros }: { parametros: ParametroRow[] }) {
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
    iniciar(async () => {
      const r = await guardarParametroAction(aFormData(null, campos));
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
        <p className="text-[13.5px] text-cuerpo">{parametros.length} parámetros.</p>
        <button
          type="button"
          onClick={() => setCreando((v) => !v)}
          className="rounded-boton border border-linea bg-white px-4 py-2 text-[13px] font-bold text-titular hover:border-titular"
        >
          {creando ? 'Cancelar' : '+ Nuevo parámetro'}
        </button>
      </div>

      {creando && (
        <div className="rounded-boton border border-linea bg-fondo p-4">
          <Formulario campos={campos} onCambio={setCampos} claveBloqueada={false} />
          {error && <p className="mt-3 text-[13px] font-semibold text-magenta">{error}</p>}
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={crear}
              disabled={pendiente}
              className="rounded-boton bg-accion px-5 py-2 text-[13.5px] font-bold text-white shadow-boton disabled:opacity-60"
            >
              {pendiente ? 'Creando…' : 'Crear parámetro'}
            </button>
          </div>
        </div>
      )}

      {parametros.length === 0 && !creando && (
        <p className="rounded-boton border border-linea bg-white p-6 text-center text-cuerpo">
          Todavía no hay parámetros.
        </p>
      )}

      <div className="space-y-3">
        {parametros.map((p) => (
          <FilaParametro key={p.id} p={p} onGuardado={refrescar} />
        ))}
      </div>
    </div>
  );
}
