'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';
import { slugificar } from '@/lib/blog/markdown';
import { subarbol, type DemografiaRow, type ParametroRow, type PartidaRow } from '@/lib/simulador/adminData';
import {
  eliminarPartidaAction,
  guardarPartidaAction,
  publicarPartidaAction,
} from '@/lib/simulador/adminActions';
import { centsAEuros, formatoEuros, formatoEurosPreciso } from '@/lib/simulador/formato';
import { resolver } from '@/lib/simulador/resolver';
import type { Ambito, ModoRC, ModoValor } from '@/lib/simulador/tipos';
import { DemografiaClient } from '../DemografiaClient';

interface Ministerio {
  id: number;
  name: string;
}

interface Props {
  raizId: string;
  parametros: ParametroRow[];
  todasPartidas: PartidaRow[];
  subarbolIds: string[];
  ministerios: Ministerio[];
  /** Filas de `sim_demografia` de ESTA área (D-S12) — profesionales del sector. */
  demografia: DemografiaRow[];
}

/** Estado editable de una fila — todo como string para inputs controlados. */
interface Campos {
  parent_id: string;
  nombre: string;
  ambito: Ambito;
  actual_modo: ModoValor;
  actual_valor_euros: string;
  actual_formula: string;
  fuente_actual: string;
  rc_modo: ModoRC;
  rc_valor_euros: string;
  rc_pct: string;
  rc_formula: string;
  justificacion_rc: string;
  ministry_id: string;
  es_palanca: boolean;
  palanca_min_euros: string;
  palanca_max_euros: string;
  color: string;
  /** D-S14: solo se lee/escribe cuando esta fila es una RAÍZ. */
  slug: string;
}

function camposDesde(p: PartidaRow): Campos {
  return {
    parent_id: p.parent_id ?? '',
    nombre: p.nombre,
    ambito: p.ambito,
    actual_modo: p.actual_modo,
    actual_valor_euros: p.actual_cents !== null ? String(centsAEuros(p.actual_cents)) : '',
    actual_formula: p.actual_formula ?? '',
    fuente_actual: p.fuente_actual ?? '',
    rc_modo: p.rc_modo,
    rc_valor_euros: p.rc_cents !== null ? String(centsAEuros(p.rc_cents)) : '',
    rc_pct: p.rc_pct !== null ? String(p.rc_pct) : '',
    rc_formula: p.rc_formula ?? '',
    justificacion_rc: p.justificacion_rc ?? '',
    ministry_id: p.ministry_id !== null ? String(p.ministry_id) : '',
    es_palanca: p.es_palanca,
    palanca_min_euros: p.palanca_min !== null ? String(centsAEuros(p.palanca_min)) : '',
    palanca_max_euros: p.palanca_max !== null ? String(centsAEuros(p.palanca_max)) : '',
    color: p.color ?? '',
    slug: p.slug ?? '',
  };
}

function campoVacio(parentId: string, tipo: 'ingreso' | 'gasto'): Campos {
  return {
    parent_id: parentId,
    nombre: '',
    ambito: 'estatal',
    actual_modo: 'fijo',
    actual_valor_euros: '',
    actual_formula: '',
    fuente_actual: '',
    rc_modo: 'fijo',
    rc_valor_euros: '',
    rc_pct: '',
    rc_formula: '',
    justificacion_rc: '',
    ministry_id: '',
    es_palanca: false,
    palanca_min_euros: '',
    palanca_max_euros: '',
    color: '',
    slug: '',
  };
}

/** Combina una fila de BD con su borrador de edición, para la previsualización en vivo. */
function previsualizar(base: PartidaRow, c: Campos): PartidaRow {
  const numOrNull = (v: string): number | null => {
    if (v.trim() === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const centsOrNull = (v: string): number | null => {
    const n = numOrNull(v);
    return n === null ? null : Math.round(n * 100);
  };
  return {
    ...base,
    parent_id: c.parent_id || null,
    nombre: c.nombre || base.nombre,
    ambito: c.ambito,
    actual_modo: c.actual_modo,
    actual_cents: c.actual_modo === 'fijo' ? (centsOrNull(c.actual_valor_euros) ?? base.actual_cents) : null,
    actual_formula: c.actual_modo === 'formula' ? c.actual_formula || null : null,
    fuente_actual: c.fuente_actual,
    rc_modo: c.rc_modo,
    rc_cents: c.rc_modo === 'fijo' ? centsOrNull(c.rc_valor_euros) : null,
    rc_pct: c.rc_modo === 'pct_actual' ? numOrNull(c.rc_pct) : null,
    rc_formula: c.rc_modo === 'formula' ? c.rc_formula || null : null,
    justificacion_rc: c.justificacion_rc,
    ministry_id: c.ministry_id ? Number(c.ministry_id) : null,
    es_palanca: c.es_palanca,
    palanca_min: c.es_palanca ? centsOrNull(c.palanca_min_euros) : null,
    palanca_max: c.es_palanca ? centsOrNull(c.palanca_max_euros) : null,
    color: c.color || null,
    slug: c.parent_id === null && c.slug.trim() ? c.slug.trim() : null,
  };
}

function campoAFormData(id: string | null, tipo: 'ingreso' | 'gasto', c: Campos): FormData {
  const fd = new FormData();
  if (id) fd.set('id', id);
  fd.set('tipo', tipo);
  fd.set('parent_id', c.parent_id);
  fd.set('nombre', c.nombre);
  fd.set('ambito', c.ambito);
  fd.set('actual_modo', c.actual_modo);
  fd.set('actual_valor_euros', c.actual_valor_euros);
  fd.set('actual_formula', c.actual_formula);
  fd.set('fuente_actual', c.fuente_actual);
  fd.set('rc_modo', c.rc_modo);
  fd.set('rc_valor_euros', c.rc_valor_euros);
  fd.set('rc_pct', c.rc_pct);
  fd.set('rc_formula', c.rc_formula);
  fd.set('justificacion_rc', c.justificacion_rc);
  fd.set('ministry_id', c.ministry_id);
  if (c.es_palanca) fd.set('es_palanca', 'on');
  fd.set('palanca_min_euros', c.palanca_min_euros);
  fd.set('palanca_max_euros', c.palanca_max_euros);
  fd.set('color', c.color);
  fd.set('slug', c.slug);
  return fd;
}

const AMBITOS: Ambito[] = ['estatal', 'autonomico', 'local', 'otro'];
const AMBITO_LABEL: Record<Ambito, string> = {
  estatal: 'Estatal',
  autonomico: 'Autonómico',
  local: 'Local',
  otro: 'Otro',
};

function FilaForm({
  campos,
  onCambio,
  ministerios,
  padresPosibles,
  mostrarPadre,
  mostrarMinisterio,
  mostrarSlug = false,
}: {
  campos: Campos;
  onCambio: (c: Campos) => void;
  ministerios: Ministerio[];
  padresPosibles: { id: string; nombre: string }[];
  mostrarPadre: boolean;
  mostrarMinisterio: boolean;
  /** D-S11/D-S14: solo true en el formulario de la propia RAÍZ. */
  mostrarSlug?: boolean;
}) {
  const set = <K extends keyof Campos>(k: K, v: Campos[K]) => onCambio({ ...campos, [k]: v });

  return (
    <div className="grid grid-cols-1 gap-3 min-[720px]:grid-cols-2">
      <label className="block text-[12.5px] font-semibold text-gris">
        Nombre
        <input
          value={campos.nombre}
          onChange={(e) => set('nombre', e.target.value)}
          className="mt-1 w-full rounded-boton border border-linea px-3 py-2 text-[14px]"
        />
      </label>

      <label className="block text-[12.5px] font-semibold text-gris">
        Ámbito
        <select
          value={campos.ambito}
          onChange={(e) => set('ambito', e.target.value as Ambito)}
          className="mt-1 w-full rounded-boton border border-linea px-3 py-2 text-[14px]"
        >
          {AMBITOS.map((a) => (
            <option key={a} value={a}>
              {AMBITO_LABEL[a]}
            </option>
          ))}
        </select>
      </label>

      {mostrarPadre && (
        <label className="block text-[12.5px] font-semibold text-gris">
          Bajo (padre)
          <select
            value={campos.parent_id}
            onChange={(e) => set('parent_id', e.target.value)}
            className="mt-1 w-full rounded-boton border border-linea px-3 py-2 text-[14px]"
          >
            {padresPosibles.map((p) => (
              <option key={p.id || 'raiz'} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>
      )}

      {mostrarMinisterio && (
        <label className="block text-[12.5px] font-semibold text-gris">
          Ministerio (alinea con el simulador ciudadano)
          <select
            value={campos.ministry_id}
            onChange={(e) => set('ministry_id', e.target.value)}
            className="mt-1 w-full rounded-boton border border-linea px-3 py-2 text-[14px]"
          >
            <option value="">— Ninguno —</option>
            {ministerios.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <fieldset className="rounded-boton border border-linea p-3 min-[720px]:col-span-2">
        <legend className="px-1 text-[12px] font-bold uppercase tracking-wide text-gris">Valor actual (oficial)</legend>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={campos.actual_modo}
            onChange={(e) => set('actual_modo', e.target.value as ModoValor)}
            className="rounded-boton border border-linea px-3 py-2 text-[13.5px]"
          >
            <option value="fijo">Valor fijo</option>
            <option value="formula">Fórmula</option>
          </select>
          {campos.actual_modo === 'fijo' ? (
            <input
              type="number"
              step="0.01"
              placeholder="€"
              value={campos.actual_valor_euros}
              onChange={(e) => set('actual_valor_euros', e.target.value)}
              className="w-40 rounded-boton border border-linea px-3 py-2 text-[14px]"
            />
          ) : (
            <input
              placeholder="p. ej. num_autonomos * cuota_media_autonomo"
              value={campos.actual_formula}
              onChange={(e) => set('actual_formula', e.target.value)}
              className="min-w-[260px] flex-1 rounded-boton border border-linea px-3 py-2 font-mono text-[13px]"
            />
          )}
        </div>
        <input
          placeholder="Fuente (BOE/PGE/IGAE con referencia concreta)"
          value={campos.fuente_actual}
          onChange={(e) => set('fuente_actual', e.target.value)}
          className="mt-2 w-full rounded-boton border border-linea px-3 py-2 text-[13.5px]"
        />
      </fieldset>

      <fieldset className="rounded-boton border border-teal/30 bg-teal/5 p-3 min-[720px]:col-span-2">
        <legend className="px-1 text-[12px] font-bold uppercase tracking-wide text-teal-texto">Valor Razón Común</legend>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={campos.rc_modo}
            onChange={(e) => set('rc_modo', e.target.value as ModoRC)}
            className="rounded-boton border border-linea px-3 py-2 text-[13.5px]"
          >
            <option value="fijo">Valor fijo (vacío = hereda el actual)</option>
            <option value="pct_actual">% sobre el actual</option>
            <option value="formula">Fórmula</option>
          </select>
          {campos.rc_modo === 'fijo' && (
            <input
              type="number"
              step="0.01"
              placeholder="€ (opcional)"
              value={campos.rc_valor_euros}
              onChange={(e) => set('rc_valor_euros', e.target.value)}
              className="w-40 rounded-boton border border-linea px-3 py-2 text-[14px]"
            />
          )}
          {campos.rc_modo === 'pct_actual' && (
            <input
              type="number"
              step="0.1"
              placeholder="-20"
              value={campos.rc_pct}
              onChange={(e) => set('rc_pct', e.target.value)}
              className="w-32 rounded-boton border border-linea px-3 py-2 text-[14px]"
            />
          )}
          {campos.rc_modo === 'formula' && (
            <input
              placeholder="fórmula (solo parámetros)"
              value={campos.rc_formula}
              onChange={(e) => set('rc_formula', e.target.value)}
              className="min-w-[260px] flex-1 rounded-boton border border-linea px-3 py-2 font-mono text-[13px]"
            />
          )}
        </div>
        <textarea
          placeholder="Justificación (el POR QUÉ — mensaje político)"
          value={campos.justificacion_rc}
          onChange={(e) => set('justificacion_rc', e.target.value)}
          rows={2}
          className="mt-2 w-full rounded-boton border border-linea px-3 py-2 text-[13.5px]"
        />
      </fieldset>

      <label className="flex items-center gap-2 text-[13px] font-semibold text-gris">
        <input
          type="checkbox"
          checked={campos.es_palanca}
          onChange={(e) => set('es_palanca', e.target.checked)}
          className="h-4 w-4 accent-accion"
        />
        Es palanca (toqueteable en el sandbox público)
      </label>

      {campos.es_palanca && (
        <div className="flex items-center gap-2 min-[720px]:col-span-1">
          <input
            type="number"
            step="0.01"
            placeholder="Mín €"
            value={campos.palanca_min_euros}
            onChange={(e) => set('palanca_min_euros', e.target.value)}
            className="w-28 rounded-boton border border-linea px-3 py-2 text-[13.5px]"
          />
          <span className="text-gris">—</span>
          <input
            type="number"
            step="0.01"
            placeholder="Máx €"
            value={campos.palanca_max_euros}
            onChange={(e) => set('palanca_max_euros', e.target.value)}
            className="w-28 rounded-boton border border-linea px-3 py-2 text-[13.5px]"
          />
        </div>
      )}

      <label className="block text-[12.5px] font-semibold text-gris">
        Color (barra y donut en /pais)
        <input
          type="color"
          value={campos.color || '#16B8A0'}
          onChange={(e) => set('color', e.target.value)}
          className="mt-1 h-9 w-16 rounded-boton border border-linea"
        />
        <span className="mt-1 block text-[11px] font-normal normal-case text-gris">
          Asignar un color propio a cada área mejora el donut de reparto en /pais — si no se asigna, se usa un color
          de una paleta de reserva (no es obligatorio).
        </span>
      </label>

      {mostrarSlug && (
        <label className="block text-[12.5px] font-semibold text-gris min-[720px]:col-span-2">
          Slug (URL de su página propia en /pais)
          <div className="mt-1 flex items-center gap-2">
            <span className="shrink-0 text-[13px] text-gris">/pais/</span>
            <input
              value={campos.slug}
              onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="defensa"
              className="min-w-0 flex-1 rounded-boton border border-linea px-3 py-2 font-mono text-[13.5px]"
            />
            <button
              type="button"
              onClick={() => set('slug', slugificar(campos.nombre))}
              className="shrink-0 rounded-boton border border-linea bg-white px-3 py-2 text-[12.5px] font-bold text-titular hover:border-titular"
            >
              Generar del nombre
            </button>
          </div>
          <span className="mt-1 block text-[11px] font-normal normal-case text-gris">
            Vacío = sin página propia (el área sigue viéndose expandible dentro de /pais, como hasta ahora). Con
            slug, esta área tiene su propia página compartible/indexable.
          </span>
        </label>
      )}
    </div>
  );
}

function FilaExistente({
  fila,
  ministerios,
  padresPosibles,
  onGuardado,
}: {
  fila: PartidaRow;
  ministerios: Ministerio[];
  padresPosibles: { id: string; nombre: string }[];
  onGuardado: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [campos, setCampos] = useState(() => camposDesde(fila));
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  useEffect(() => {
    if (!abierto) setCampos(camposDesde(fila));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fila, abierto]);

  const previa = previsualizar(fila, campos);

  function guardar() {
    setError(null);
    iniciar(async () => {
      const r = await guardarPartidaAction(campoAFormData(fila.id, fila.tipo, campos));
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
      const r = await eliminarPartidaAction(fila.id);
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
      const r = await publicarPartidaAction(fila.id, valor);
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
            Actual {formatoEuros(previa.actual_cents)} · RC {formatoEuros(previsualizar(fila, campos).rc_cents ?? previa.actual_cents)}
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
          <FilaForm
            campos={campos}
            onCambio={setCampos}
            ministerios={ministerios}
            padresPosibles={padresPosibles}
            mostrarPadre
            mostrarMinisterio={fila.parent_id === null}
          />
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

export function AreaEditorClient({ raizId, parametros, todasPartidas, subarbolIds, ministerios, demografia }: Props) {
  const router = useRouter();
  const raiz = todasPartidas.find((p) => p.id === raizId)!;
  const hijas = todasPartidas.filter((p) => subarbolIds.includes(p.id) && p.id !== raizId);

  const [borradorRaiz, setBorradorRaiz] = useState(() => camposDesde(raiz));
  const [creando, setCreando] = useState(false);
  const [campoNueva, setCampoNueva] = useState(() => campoVacio(raizId, raiz.tipo));
  const [errorNueva, setErrorNueva] = useState<string | null>(null);
  const [errorRaiz, setErrorRaiz] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  useEffect(() => setBorradorRaiz(camposDesde(raiz)), [raiz]);

  function refrescar() {
    router.refresh();
  }

  // Previsualización EN VIVO: se sustituye la raíz y (si hay una hija nueva
  // con nombre) se añade, y se recalcula con el motor real — mismo
  // resolver.ts que usa el servidor, sin duplicar lógica (D-S7).
  const partidasPreview = useMemo(() => {
    const base = todasPartidas.map((p) => (p.id === raizId ? previsualizar(raiz, borradorRaiz) : p));
    if (creando && campoNueva.nombre.trim()) {
      base.push(previsualizar({ ...raiz, id: '__nueva__', parent_id: campoNueva.parent_id || raizId }, campoNueva));
    }
    return base;
  }, [todasPartidas, raizId, raiz, borradorRaiz, creando, campoNueva]);

  const modelo = useMemo(() => resolver(parametros, partidasPreview), [parametros, partidasPreview]);
  const infoRaiz = modelo.partidas.find((p) => p.id === raizId)!;

  const padresPosiblesParaHijas = [{ id: raizId, nombre: `${raiz.nombre} (raíz)` }, ...hijas.map((h) => ({ id: h.id, nombre: h.nombre }))];

  function guardarRaiz() {
    setErrorRaiz(null);
    iniciar(async () => {
      const r = await guardarPartidaAction(campoAFormData(raizId, raiz.tipo, { ...borradorRaiz, parent_id: '' }));
      if (!r.ok) {
        setErrorRaiz(r.error ?? 'No se ha podido guardar.');
        return;
      }
      refrescar();
    });
  }

  function crearHija() {
    setErrorNueva(null);
    if (!campoNueva.nombre.trim()) {
      setErrorNueva('El nombre es obligatorio.');
      return;
    }
    iniciar(async () => {
      const r = await guardarPartidaAction(campoAFormData(null, raiz.tipo, campoNueva));
      if (!r.ok) {
        setErrorNueva(r.error ?? 'No se ha podido crear.');
        return;
      }
      setCreando(false);
      setCampoNueva(campoVacio(raizId, raiz.tipo));
      refrescar();
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-tarjeta border border-linea bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-extrabold text-titular">{raiz.nombre}</h1>
            <p className="text-[12.5px] text-gris">
              {raiz.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'} · {hijas.length} subpartida{hijas.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 text-right">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-gris">Total actual</p>
              <p className="text-[20px] font-extrabold text-cuerpo">{formatoEurosPreciso(infoRaiz.actual.propioCents)}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-gris">Total RC</p>
              <p className="text-[20px] font-extrabold text-titular">{formatoEurosPreciso(infoRaiz.rc.propioCents)}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-boton bg-fondo p-3 text-[13px]">
          <span>
            Sin desglosar (actual): <strong>{formatoEuros(infoRaiz.actual.sinDesglosarCents)}</strong>
          </span>
          <span>
            Sin desglosar (RC): <strong>{formatoEuros(infoRaiz.rc.sinDesglosarCents)}</strong>
          </span>
          {(infoRaiz.actual.descuadre || infoRaiz.rc.descuadre) && (
            <span className="font-bold text-naranja">⚠ Las subpartidas suman más que el total declarado</span>
          )}
          <span className="ml-auto font-semibold text-gris">
            Balance global en vivo — Actual {formatoEuros(modelo.balance.actualCents)} · RC{' '}
            {formatoEuros(modelo.balance.rcCents)}
          </span>
        </div>

        <div className="mt-4 border-t border-linea pt-4">
          <FilaForm
            campos={borradorRaiz}
            onCambio={setBorradorRaiz}
            ministerios={ministerios}
            padresPosibles={[]}
            mostrarPadre={false}
            mostrarMinisterio
            mostrarSlug
          />
          {errorRaiz && <p className="mt-3 text-[13px] font-semibold text-magenta">{errorRaiz}</p>}
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={guardarRaiz}
              disabled={pendiente}
              className="rounded-boton bg-accion px-5 py-2 text-[13.5px] font-bold text-white shadow-boton disabled:opacity-60"
            >
              {pendiente ? 'Guardando…' : 'Guardar área'}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-bold text-titular">Subpartidas</h2>
          <button
            type="button"
            onClick={() => setCreando((v) => !v)}
            className="rounded-boton border border-linea bg-white px-4 py-2 text-[13px] font-bold text-titular hover:border-titular"
          >
            {creando ? 'Cancelar' : '+ Añadir subpartida'}
          </button>
        </div>

        {creando && (
          <div className="rounded-boton border border-linea bg-fondo p-4">
            <FilaForm
              campos={campoNueva}
              onCambio={setCampoNueva}
              ministerios={ministerios}
              padresPosibles={padresPosiblesParaHijas}
              mostrarPadre
              mostrarMinisterio={false}
            />
            {errorNueva && <p className="mt-3 text-[13px] font-semibold text-magenta">{errorNueva}</p>}
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={crearHija}
                disabled={pendiente}
                className="rounded-boton bg-accion px-5 py-2 text-[13.5px] font-bold text-white shadow-boton disabled:opacity-60"
              >
                {pendiente ? 'Creando…' : 'Crear subpartida'}
              </button>
            </div>
          </div>
        )}

        {hijas.length === 0 && !creando && (
          <p className="rounded-boton border border-linea bg-white p-6 text-center text-cuerpo">
            Esta área todavía no tiene subpartidas.
          </p>
        )}

        <div className="space-y-3">
          {hijas.map((h) => (
            <FilaExistente
              key={h.id}
              fila={h}
              ministerios={ministerios}
              padresPosibles={padresPosiblesParaHijas.filter(
                (p) => p.id !== h.id && !subarbol(todasPartidas, h.id).some((d) => d.id === p.id),
              )}
              onGuardado={refrescar}
            />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-[16px] font-bold text-titular">Profesionales de este sector</h2>
          <p className="mt-1 max-w-[65ch] text-[12.5px] text-cuerpo">
            Datos informativos (D-S13: sin lado Razón Común) que alimentan los dos gráficos obligatorios de la
            página propia de esta área en <code>/pais</code> — reparto de profesionales por tipo y sueldo medio.
          </p>
        </div>
        <DemografiaClient areaId={raizId} filas={demografia} />
      </div>
    </div>
  );
}
