'use client';

/**
 * app/pais/[slug]/PanelMinisterio.tsx
 *
 * Panel público de una página de ministerio (D-S11, docs/tecnico/
 * simulador-pais.md §9). Reutiliza el mismo motor y los mismos componentes
 * de interacción que `/pais` (PanelPais.tsx) — resolver/cascada/palancas —
 * pero acotado a UNA raíz vía `Bloque`'s prop `raizFija` (D-S7: sigue
 * siendo el mismo `resolver()` recalculando en cliente, cero red).
 *
 * `partidas` que llega aquí YA es el subárbol de esta raíz (`subarbol()` en
 * el Server Component `page.tsx`) — el balance global no hace falta en esta
 * página, solo la comparación propia de esta área y su desglose.
 * `parametros` sigue siendo el conjunto COMPLETO publicado: una fórmula de
 * esta área puede referenciar cualquier parámetro, no solo los "suyos".
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { DemografiaRow, ParametroRow, PartidaRow } from '@/lib/simulador/adminData';
import { formatoCorto } from '@/lib/simulador/formato';
import { resolver } from '@/lib/simulador/resolver';
import type { ModeloResuelto, Overrides } from '@/lib/simulador/tipos';
import { Bloque } from '../PanelPais';
import { CountUp } from '../CountUp';
import { DonutChart } from '../DonutChart';
import { detectarCascada, type ResultadoCascada } from '../cascada';
import { BarraSueldos } from './BarraSueldos';

interface Props {
  raizId: string;
  parametros: ParametroRow[];
  /** Subárbol de esta raíz (raíz + descendientes) — ver comentario de arriba. */
  partidas: PartidaRow[];
  /** Filas de `sim_demografia` con `area_id = raizId`, ya filtradas por RLS a `publicado=true`. */
  demografia: DemografiaRow[];
}

function clamp(v: number, min: number, max: number): number {
  if (Number.isNaN(v)) return min;
  return Math.min(max, Math.max(min, v));
}

function pasoRazonable(min: number, max: number): number {
  const rango = max - min;
  if (!(rango > 0)) return 1;
  return rango / 200;
}

/** Copia local de la misma comprobación de `PanelPais.tsx` (referencia de palabra completa en una fórmula). */
function referenciaFormula(formula: string | null, clave: string): boolean {
  if (!formula) return false;
  return new RegExp(`\\b${clave}\\b`).test(formula);
}

export function PanelMinisterio({ raizId, parametros, partidas, demografia }: Props) {
  const raiz = partidas.find((p) => p.id === raizId)!;

  const [overridesParametros, setOverridesParametros] = useState<Record<string, number>>({});
  const [overridesPartidas, setOverridesPartidas] = useState<Record<string, number>>({});

  const overrides: Overrides = useMemo(
    () => ({ parametros: overridesParametros, partidas: overridesPartidas }),
    [overridesParametros, overridesPartidas],
  );

  const modelo = useMemo(() => resolver(parametros, partidas, overrides), [parametros, partidas, overrides]);

  const modeloAnteriorRef = useRef<ModeloResuelto>(modelo);
  const origenPendienteRef = useRef<{ tipo: 'parametro' | 'partida'; id: string; nombre: string } | null>(null);
  const [cascada, setCascada] = useState<ResultadoCascada | null>(null);
  const [pulsoGen, setPulsoGen] = useState(0);

  useEffect(() => {
    const anterior = modeloAnteriorRef.current;
    modeloAnteriorRef.current = modelo;
    if (anterior === modelo) return;

    const origen = origenPendienteRef.current;
    origenPendienteRef.current = null;
    if (!origen) return;

    const origenTipado =
      origen.tipo === 'parametro'
        ? ({ tipo: 'parametro', clave: origen.id, nombre: origen.nombre } as const)
        : ({ tipo: 'partida', id: origen.id, nombre: origen.nombre } as const);

    const resultado = detectarCascada(origenTipado, anterior, modelo);
    if (resultado.huboCambio) {
      setCascada(resultado);
      setPulsoGen((g) => g + 1);
    }
  }, [modelo]);

  useEffect(() => {
    if (!cascada) return;
    const t = setTimeout(() => setCascada(null), 5200);
    return () => clearTimeout(t);
  }, [cascada]);

  function moverParametro(clave: string, nombre: string, valorNuevo: number) {
    const p = parametros.find((x) => x.clave === clave);
    const acotado =
      p?.palanca_min !== null && p?.palanca_min !== undefined && p?.palanca_max !== null && p?.palanca_max !== undefined
        ? clamp(valorNuevo, p.palanca_min, p.palanca_max)
        : valorNuevo;
    origenPendienteRef.current = { tipo: 'parametro', id: clave, nombre };
    setOverridesParametros((prev) => ({ ...prev, [clave]: acotado }));
  }

  function moverPartida(id: string, nombre: string, centsNuevo: number) {
    const p = partidas.find((x) => x.id === id);
    const acotado =
      p?.palanca_min !== null && p?.palanca_min !== undefined && p?.palanca_max !== null && p?.palanca_max !== undefined
        ? clamp(centsNuevo, p.palanca_min, p.palanca_max)
        : centsNuevo;
    origenPendienteRef.current = { tipo: 'partida', id, nombre };
    setOverridesPartidas((prev) => ({ ...prev, [id]: acotado }));
  }

  function restablecer() {
    setOverridesParametros({});
    setOverridesPartidas({});
    setCascada(null);
  }

  const hayOverrides = Object.keys(overridesParametros).length > 0 || Object.keys(overridesPartidas).length > 0;

  const partidaPorId = useMemo(() => new Map(partidas.map((p) => [p.id, p])), [partidas]);
  const infoPorId = useMemo(() => new Map(modelo.partidas.map((p) => [p.id, p])), [modelo]);
  const hijosDe = useMemo(() => {
    const mapa = new Map<string, string[]>();
    for (const p of partidas) {
      if (p.parent_id !== null) {
        if (!mapa.has(p.parent_id)) mapa.set(p.parent_id, []);
        mapa.get(p.parent_id)!.push(p.id);
      }
    }
    return mapa;
  }, [partidas]);

  // Misma colocación de palancas-parámetro que PanelPais (S2.1), acotada al
  // subárbol de esta raíz (`partidas` aquí ya solo contiene ese subárbol).
  const partidaIdPorParametro = useMemo(() => {
    const mapa = new Map<string, string>();
    const palancas = parametros.filter((p) => p.es_palanca && p.palanca_min !== null && p.palanca_max !== null);
    for (const p of palancas) {
      const candidatas = partidas.filter(
        (pt) => referenciaFormula(pt.actual_formula, p.clave) || referenciaFormula(pt.rc_formula, p.clave),
      );
      if (candidatas.length === 0) continue;
      const elegida = [...candidatas].sort((a, b) => {
        const aEspecifica = a.parent_id !== null ? 0 : 1;
        const bEspecifica = b.parent_id !== null ? 0 : 1;
        if (aEspecifica !== bEspecifica) return aEspecifica - bEspecifica;
        return a.orden - b.orden;
      })[0];
      mapa.set(p.clave, elegida.id);
    }
    return mapa;
  }, [parametros, partidas]);

  const parametrosPorPartida = useMemo(() => {
    const mapa = new Map<string, ParametroRow[]>();
    for (const [clave, partidaId] of partidaIdPorParametro) {
      const param = parametros.find((p) => p.clave === clave);
      if (!param) continue;
      if (!mapa.has(partidaId)) mapa.set(partidaId, []);
      mapa.get(partidaId)!.push(param);
    }
    return mapa;
  }, [partidaIdPorParametro, parametros]);

  const [ruta, setRuta] = useState<string[]>([]);

  const infoRaiz = infoPorId.get(raizId)!;
  const hijosIdsRaiz = hijosDe.get(raizId) ?? [];
  const segmentosHijosRaiz = hijosIdsRaiz
    .map((id) => {
      const h = partidaPorId.get(id);
      const infoH = infoPorId.get(id);
      if (!h || !infoH) return null;
      return { nombre: h.nombre, valor: infoH.rc.propioCents ?? 0, color: h.color };
    })
    .filter((s): s is { nombre: string; valor: number; color: string | null } => s !== null);

  const clavesPulso = cascada?.clavesPulso ?? new Set<string>();
  const idsPulso = cascada?.idsPulso ?? new Set<string>();

  const deltaPct =
    infoRaiz.actual.propioCents !== null && infoRaiz.actual.propioCents !== 0 && infoRaiz.rc.propioCents !== null
      ? ((infoRaiz.rc.propioCents - infoRaiz.actual.propioCents) / Math.abs(infoRaiz.actual.propioCents)) * 100
      : null;

  const demografiaConValor = demografia.filter((f) => f.num_personas > 0);
  const segmentosProfesionales = demografiaConValor.map((f) => ({ nombre: f.nombre, valor: f.num_personas, color: null }));

  return (
    <div>
      <header className="mx-auto max-w-[900px] text-center">
        <span className="text-[13px] font-bold uppercase tracking-[.14em] text-titular">
          {raiz.tipo === 'gasto' ? 'Gasto público' : 'Ingreso público'}
        </span>
        <h1 className="mt-3 text-[clamp(26px,4vw,40px)] font-extrabold leading-[1.12]">{raiz.nombre}</h1>

        <div className="mx-auto mt-7 grid max-w-[560px] grid-cols-1 gap-4 min-[520px]:grid-cols-2">
          <div className="rounded-tarjeta border border-linea bg-white p-5">
            <p className="text-[12px] font-bold uppercase tracking-wide text-gris">Actual (oficial)</p>
            <p className="mt-1 text-[26px] font-extrabold tabular-nums text-titular">
              <CountUp value={infoRaiz.actual.propioCents ?? 0} formatear={(n) => formatoCorto(Math.round(n))} />
            </p>
          </div>
          <div className="rounded-tarjeta border border-teal/30 bg-teal/5 p-5">
            <p className="text-[12px] font-bold uppercase tracking-wide text-teal-texto">Razón Común</p>
            <p className="mt-1 text-[26px] font-extrabold tabular-nums text-teal-texto">
              <CountUp value={infoRaiz.rc.propioCents ?? 0} formatear={(n) => formatoCorto(Math.round(n))} />
            </p>
          </div>
        </div>

        {deltaPct !== null && Math.abs(deltaPct) >= 0.5 && (
          <p className="mt-3 text-[13px] font-bold text-teal-texto">
            {deltaPct > 0 ? '+' : ''}
            {deltaPct.toFixed(0)}% frente al presupuesto oficial
          </p>
        )}
        {(infoRaiz.actual.descuadre || infoRaiz.rc.descuadre) && (
          <p className="mt-2 text-[12.5px] font-bold text-naranja">⚠ Las subpartidas suman más que el total declarado</p>
        )}

        {(raiz.fuente_actual?.trim() || raiz.justificacion_rc?.trim()) && (
          <div className="mx-auto mt-5 max-w-[62ch] space-y-1.5 text-left text-[12.5px] text-cuerpo">
            {raiz.fuente_actual?.trim() && (
              <p>
                <strong className="text-titular">Fuente (actual):</strong> {raiz.fuente_actual}
              </p>
            )}
            {raiz.justificacion_rc?.trim() && (
              <p>
                <strong className="text-teal-texto">Justificación RC:</strong> {raiz.justificacion_rc}
              </p>
            )}
          </div>
        )}
      </header>

      {segmentosHijosRaiz.some((s) => s.valor > 0) && (
        <div className="mx-auto mt-8 max-w-[720px] rounded-tarjeta border border-linea bg-white p-5">
          <p className="mb-2 text-[11.5px] font-bold uppercase tracking-wide text-gris">
            Reparto de {raiz.nombre} — propuesta RC
          </p>
          <DonutChart segmentos={segmentosHijosRaiz} titulo={raiz.nombre} />
        </div>
      )}

      {(segmentosProfesionales.length > 0 || demografiaConValor.some((f) => f.valor_medio_cents !== null)) && (
        <div className="mx-auto mt-6 grid max-w-[900px] grid-cols-1 gap-5 min-[720px]:grid-cols-2">
          {segmentosProfesionales.length > 0 && (
            <div className="rounded-tarjeta border border-linea bg-white p-5">
              <p className="mb-2 text-[11.5px] font-bold uppercase tracking-wide text-gris">
                Reparto de profesionales por tipo
              </p>
              <DonutChart segmentos={segmentosProfesionales} titulo="Profesionales" />
            </div>
          )}
          <BarraSueldos filas={demografiaConValor} />
        </div>
      )}

      {hayOverrides && (
        <div className="mx-auto mt-6 max-w-[900px] text-center">
          <button
            type="button"
            onClick={restablecer}
            className="rounded-boton border border-linea bg-white px-4 py-2 text-[13px] font-bold text-titular hover:border-titular"
          >
            Restablecer todas las palancas
          </button>
        </div>
      )}

      <div className="mx-auto mt-8 max-w-[900px]">
        <Bloque
          tipo={raiz.tipo}
          ruta={ruta}
          setRuta={setRuta}
          raizFija={raizId}
          partidas={partidas}
          partidaPorId={partidaPorId}
          infoPorId={infoPorId}
          hijosDe={hijosDe}
          idsPulso={idsPulso}
          clavesPulso={clavesPulso}
          parametrosPorPartida={parametrosPorPartida}
          overridesParametros={overridesParametros}
          overridesPartidas={overridesPartidas}
          onMoverParametro={moverParametro}
          onMoverPartida={moverPartida}
        />
      </div>

      {cascada?.huboCambio && cascada.cadenaTexto && (
        <div
          key={pulsoGen}
          role="status"
          aria-live="polite"
          className="pais-cadena-in fixed inset-x-4 bottom-4 z-40 mx-auto max-w-[640px] rounded-boton border border-teal/40 bg-white/95 p-4 shadow-tarjeta backdrop-blur min-[720px]:inset-x-auto min-[720px]:right-6"
        >
          <p className="text-[11.5px] font-bold uppercase tracking-wide text-teal-texto">Efecto en cadena</p>
          <p className="mt-1 text-[13.5px] font-semibold leading-snug text-titular">{cascada.cadenaTexto}</p>
        </div>
      )}
    </div>
  );
}
