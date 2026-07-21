'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import type { DemografiaRow, ParametroRow, PartidaRow } from '@/lib/simulador/adminData';
import { centsAEuros, formatoCorto } from '@/lib/simulador/formato';
import { resolver } from '@/lib/simulador/resolver';
import type { ModeloResuelto, Overrides, PartidaResueltaInfo, TipoPartida } from '@/lib/simulador/tipos';
import { CountUp } from './CountUp';
import { DonutChart } from './DonutChart';
import { SeccionPoblacion } from './SeccionPoblacion';
import { TopIngresos } from './TopIngresos';
import { detectarCascada, type ResultadoCascada } from './cascada';

interface Props {
  parametros: ParametroRow[];
  partidas: PartidaRow[];
  beta: boolean;
  /** D-S12/D-S11: sección "Población de España", justo tras la Cabecera. */
  demografiaPais: DemografiaRow[];
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

/** Cadena de ancestros de `id` (raíz → … → id), siguiendo `parent_id`. */
function ancestros(id: string, partidaPorId: Map<string, PartidaRow>): string[] {
  const cadena: string[] = [];
  const vistos = new Set<string>();
  let actual: string | undefined = id;
  while (actual && !vistos.has(actual)) {
    vistos.add(actual);
    cadena.unshift(actual);
    actual = partidaPorId.get(actual)?.parent_id ?? undefined;
  }
  return cadena;
}

/**
 * Referencia de palabra completa a `clave` dentro de un texto de fórmula
 * (`num_autonomos` no debe casar con `num_autonomos_base`). `clave` sigue
 * el patrón `^[a-z][a-z0-9_]*$` (validado al guardar en el admin), así que
 * es segura de interpolar directamente en un `RegExp` sin escapar.
 */
function referenciaFormula(formula: string | null, clave: string): boolean {
  if (!formula) return false;
  return new RegExp(`\\b${clave}\\b`).test(formula);
}

export function PanelPais({ parametros, partidas, beta, demografiaPais }: Props) {
  const [overridesParametros, setOverridesParametros] = useState<Record<string, number>>({});
  const [overridesPartidas, setOverridesPartidas] = useState<Record<string, number>>({});

  const overrides: Overrides = useMemo(
    () => ({ parametros: overridesParametros, partidas: overridesPartidas }),
    [overridesParametros, overridesPartidas],
  );

  // D-S7: el MISMO resolver.ts del servidor, recalculando en el navegador —
  // cero red al mover una palanca.
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

  // Defensa en profundidad (D-009 / QA adversario): el slider ya manda un
  // valor recortado a [min,max], pero el estado NUNCA debe poder acabar
  // fuera de rango pase lo que pase por el camino (devtools, una prop
  // manipulada, un futuro caller que se salte el slider) — se busca el
  // límite real en `parametros`/`partidas` y se recorta aquí también, no
  // solo en el `onChange`.
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

  // Ubicación de las palancas-parámetro (S2.1): cada parámetro-palanca se
  // monta DENTRO de la partida que lo usa en su fórmula (actual o RC), en
  // vez de en un sandbox aparte — así se ve "en el ministerio que toca".
  // Criterio cuando varias partidas referencian el mismo parámetro:
  // se prioriza la más específica (con padre, es decir una hija) sobre una
  // raíz, y entre varias hijas, la primera por `orden` — determinista y
  // evita duplicar el mismo control (mismo `id` de DOM) en dos sitios.
  // Si ninguna partida publicada lo referencia, el parámetro es "huérfano"
  // y cae en la mini-sección compacta del final (no se pierde el control).
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

  const parametrosHuerfanos = useMemo(
    () =>
      parametros.filter(
        (p) => p.es_palanca && p.palanca_min !== null && p.palanca_max !== null && !partidaIdPorParametro.has(p.clave),
      ),
    [parametros, partidaIdPorParametro],
  );

  const [rutaGasto, setRutaGasto] = useState<string[]>([]);
  const [rutaIngreso, setRutaIngreso] = useState<string[]>([]);

  function irADesglose(id: string) {
    const fila = partidaPorId.get(id);
    if (!fila) return;
    const cadena = ancestros(id, partidaPorId).slice(0, -1);
    if (fila.tipo === 'gasto') setRutaGasto(cadena);
    else setRutaIngreso(cadena);
    document.getElementById(fila.tipo === 'gasto' ? 'bloque-gastos' : 'bloque-ingresos')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  const primerAfectado = cascada ? [...cascada.idsPulso][0] : undefined;
  const clavesPulso = cascada?.clavesPulso ?? new Set<string>();
  const idsPulso = cascada?.idsPulso ?? new Set<string>();

  return (
    <div>
      <Cabecera modelo={modelo} beta={beta} />

      <SeccionPoblacion filas={demografiaPais} />

      {hayOverrides && (
        <div className="mx-auto mt-4 max-w-[1080px] text-center">
          <button
            type="button"
            onClick={restablecer}
            className="rounded-boton border border-linea bg-white px-4 py-2 text-[13px] font-bold text-titular hover:border-titular"
          >
            Restablecer todas las palancas
          </button>
        </div>
      )}

      <TopIngresos partidas={partidas} infoPorId={infoPorId} />

      <div className="mx-auto mt-8 grid max-w-[1080px] grid-cols-1 gap-8 min-[900px]:grid-cols-2">
        <section id="bloque-gastos">
          <h2 className="text-[15px] font-extrabold uppercase tracking-wide text-titular">Gastos</h2>
          <div className="mt-3">
            <Bloque
              tipo="gasto"
              ruta={rutaGasto}
              setRuta={setRutaGasto}
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
        </section>

        <section id="bloque-ingresos">
          <h2 className="text-[15px] font-extrabold uppercase tracking-wide text-titular">Ingresos</h2>
          <div className="mt-3">
            <Bloque
              tipo="ingreso"
              ruta={rutaIngreso}
              setRuta={setRutaIngreso}
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
        </section>
      </div>

      <PalancasHuerfanas
        parametros={parametrosHuerfanos}
        overridesParametros={overridesParametros}
        clavesPulso={clavesPulso}
        onMoverParametro={moverParametro}
      />

      {cascada?.huboCambio && cascada.cadenaTexto && (
        <CadenaFlotante
          key={pulsoGen}
          cascada={cascada}
          onVerDesglose={primerAfectado ? () => irADesglose(primerAfectado) : undefined}
        />
      )}
    </div>
  );
}

function Cabecera({ modelo, beta }: { modelo: ModeloResuelto; beta: boolean }) {
  return (
    <>
    <header className="mx-auto max-w-[900px] text-center">
      <span className="text-[13px] font-bold uppercase tracking-[.14em] text-titular">
        Base de datos del país
      </span>
      <h1 className="mt-3 text-[clamp(28px,4vw,44px)] font-extrabold leading-[1.12]">
        El Presupuesto del País
      </h1>
      <p className="mx-auto mt-3 max-w-[62ch] text-[15.5px] text-cuerpo">
        El presupuesto oficial de España, comparado con el de Razón Común — área a área, con fuente oficial y
        justificación política. Mueve las palancas y mira el efecto en cadena.
      </p>

      {beta && (
        <p className="mx-auto mt-4 inline-block rounded-full border border-naranja/40 bg-naranja/10 px-4 py-1.5 text-[12.5px] font-bold text-naranja">
          🚧 Beta — en construcción: cada semana publicamos más áreas
        </p>
      )}
    </header>

      {/* Tarjetas de balance FUERA del <header> (max-w-900, pensado para texto
          legible) — Sergio pidió que ocupen el 50% de anchura cada una; con el
          header de texto ya son casi tan anchas como el titular. Ancho a
          max-w-[1080px], igual que Bloques/TopIngresos/SeccionPoblacion, para
          que en desktop cada tarjeta sea realmente la mitad del contenido de
          la página, no de un sub-contenedor artificialmente estrecho. */}
      <div className="mx-auto mt-8 grid max-w-[1080px] grid-cols-1 gap-4 min-[520px]:grid-cols-2">
        <div className="rounded-tarjeta border border-linea bg-white p-5 text-center">
          <p className="text-[12px] font-bold uppercase tracking-wide text-gris">Balance actual (oficial)</p>
          <p
            className={cn(
              'mt-1 text-[28px] font-extrabold tabular-nums',
              modelo.balance.actualCents >= 0 ? 'text-titular' : 'text-magenta',
            )}
          >
            <CountUp value={modelo.balance.actualCents} formatear={(n) => formatoCorto(Math.round(n))} />
          </p>
        </div>
        <div className="rounded-tarjeta border border-teal/30 bg-teal/5 p-5 text-center">
          <p className="text-[12px] font-bold uppercase tracking-wide text-teal-texto">Balance Razón Común</p>
          <p
            className={cn(
              'mt-1 text-[28px] font-extrabold tabular-nums',
              modelo.balance.rcCents >= 0 ? 'text-teal-texto' : 'text-magenta',
            )}
          >
            <CountUp value={modelo.balance.rcCents} formatear={(n) => formatoCorto(Math.round(n))} />
          </p>
        </div>
      </div>

      {modelo.sinResolver.length > 0 && (
        <p className="mx-auto mt-3 max-w-[62ch] text-center text-[12.5px] text-gris">
          ⚠ {modelo.sinResolver.length} elemento{modelo.sinResolver.length === 1 ? '' : 's'} publicado
          {modelo.sinResolver.length === 1 ? '' : 's'} sin resolver — no cuenta
          {modelo.sinResolver.length === 1 ? '' : 'n'} en el balance.
        </p>
      )}
    </>
  );
}

/**
 * Exportado (S3.1, D-S11) para que `PanelMinisterio` (`/pais/[slug]`)
 * reutilice EXACTAMENTE el mismo drill-down in-place que `/pais`, solo
 * acotado a una raíz vía `raizFija`: en vez de listar TODAS las raíces del
 * bloque en `ruta.length === 0`, lista directamente los hijos de
 * `raizFija` — la página de ministerio "ya empieza dentro" de su área, tal
 * como pide el doc de arquitectura §9.
 */
export function Bloque({
  tipo,
  ruta,
  setRuta,
  partidas,
  partidaPorId,
  infoPorId,
  hijosDe,
  idsPulso,
  clavesPulso,
  parametrosPorPartida,
  overridesParametros,
  overridesPartidas,
  onMoverParametro,
  onMoverPartida,
  raizFija,
}: {
  tipo: TipoPartida;
  ruta: string[];
  setRuta: (r: string[]) => void;
  partidas: PartidaRow[];
  partidaPorId: Map<string, PartidaRow>;
  infoPorId: Map<string, PartidaResueltaInfo>;
  hijosDe: Map<string, string[]>;
  idsPulso: Set<string>;
  clavesPulso: Set<string>;
  parametrosPorPartida: Map<string, ParametroRow[]>;
  overridesParametros: Record<string, number>;
  overridesPartidas: Record<string, number>;
  onMoverParametro: (clave: string, nombre: string, valorNuevo: number) => void;
  onMoverPartida: (id: string, nombre: string, centsNuevo: number) => void;
  /** Id de la partida raíz a la que esta instancia de `Bloque` queda acotada (página de ministerio). */
  raizFija?: string;
}) {
  const nivelActualId = ruta.length > 0 ? ruta[ruta.length - 1] : (raizFija ?? null);
  const idsNivel =
    nivelActualId === null
      ? partidas.filter((p) => p.tipo === tipo && p.parent_id === null).map((p) => p.id)
      : (hijosDe.get(nivelActualId) ?? []);

  const filas = idsNivel
    .map((id) => partidaPorId.get(id))
    .filter((p): p is PartidaRow => Boolean(p))
    .sort((a, b) => a.orden - b.orden);

  const maxCents = Math.max(
    1,
    ...filas.flatMap((f) => {
      const info = infoPorId.get(f.id);
      return [info?.actual.propioCents ?? 0, info?.rc.propioCents ?? 0];
    }),
  );

  // Donut de reparto (S2.1, item 2a): SIEMPRE el reparto de las ÁREAS RAÍZ
  // de este bloque sobre el total del bloque, lado RC — independiente del
  // nivel de drill-down en el que esté el visitante (las raíces no
  // cambian). "Eso mismo se repite en los ministerios" vive dentro de cada
  // `FilaPartida` con hijos (ver más abajo), con el dataset de sus hijos.
  const raicesTipo = partidas
    .filter((p) => p.tipo === tipo && p.parent_id === null)
    .sort((a, b) => a.orden - b.orden);
  const segmentosRaices = raicesTipo.map((r) => ({
    nombre: r.nombre,
    valor: infoPorId.get(r.id)?.rc.propioCents ?? 0,
    color: r.color,
  }));
  // En modo acotado (página de ministerio) este donut de TODAS las raíces
  // del bloque no pinta nada — esa página tiene su propio donut de SUS
  // hijos (D-S11), montado aparte en `PanelMinisterio`.
  const hayDatosRaices = !raizFija && segmentosRaices.some((s) => s.valor > 0);

  return (
    <div>
      {hayDatosRaices && (
        <div className="mb-4 rounded-boton border border-linea bg-white p-4">
          <p className="mb-2 text-[11.5px] font-bold uppercase tracking-wide text-gris">
            Reparto por área — propuesta RC
          </p>
          <DonutChart segmentos={segmentosRaices} titulo={tipo === 'gasto' ? 'Gastos' : 'Ingresos'} />
        </div>
      )}

      <nav aria-label="Ruta de navegación" className="mb-3 flex flex-wrap items-center gap-1 text-[12.5px] text-gris">
        <button
          type="button"
          onClick={() => setRuta([])}
          className={cn('font-bold', ruta.length === 0 ? 'text-titular' : 'hover:text-titular')}
        >
          {raizFija ? (partidaPorId.get(raizFija)?.nombre ?? (tipo === 'gasto' ? 'Gastos' : 'Ingresos')) : tipo === 'gasto' ? 'Gastos' : 'Ingresos'}
        </button>
        {ruta.map((id, i) => (
          <span key={id} className="flex items-center gap-1">
            <span aria-hidden>/</span>
            <button
              type="button"
              onClick={() => setRuta(ruta.slice(0, i + 1))}
              className={cn(i === ruta.length - 1 ? 'font-bold text-titular' : 'hover:text-titular')}
            >
              {partidaPorId.get(id)?.nombre ?? '—'}
            </button>
          </span>
        ))}
      </nav>

      <div key={nivelActualId ?? '__raiz__'} className="fade space-y-2.5">
        {filas.length === 0 && (
          <p className="rounded-boton border border-linea bg-white p-4 text-[13.5px] text-cuerpo">
            No hay más desglose publicado para esta área todavía.
          </p>
        )}
        {filas.map((fila) => {
          const info = infoPorId.get(fila.id);
          if (!info) return null;
          const hijosIds = hijosDe.get(fila.id) ?? [];
          const tieneHijos = hijosIds.length > 0;
          const pulsando = idsPulso.has(fila.id);
          const deltaPct =
            info.actual.propioCents !== null && info.actual.propioCents !== 0 && info.rc.propioCents !== null
              ? ((info.rc.propioCents - info.actual.propioCents) / Math.abs(info.actual.propioCents)) * 100
              : null;

          const segmentosHijos = hijosIds
            .map((id) => {
              const h = partidaPorId.get(id);
              const infoH = infoPorId.get(id);
              if (!h || !infoH) return null;
              return { nombre: h.nombre, valor: infoH.rc.propioCents ?? 0, color: h.color };
            })
            .filter((s): s is { nombre: string; valor: number; color: string | null } => s !== null);

          const parametrosAsociados = parametrosPorPartida.get(fila.id) ?? [];

          // D-S11: al clicar una fila RAÍZ del nivel superior (nunca en modo
          // acotado — ahí "el nivel superior" ya son los hijos de la
          // raízFija, no otras raíces), navega a su página propia SI tiene
          // slug. Sin slug, fallback intacto: expandir in-place (onDrill).
          const hrefPropio = nivelActualId === null && fila.slug ? `/pais/${fila.slug}` : undefined;

          return (
            <FilaPartida
              key={`${fila.id}-${pulsando ? 'pulso' : 'quieto'}`}
              fila={fila}
              info={info}
              maxCents={maxCents}
              tieneHijos={tieneHijos}
              pulsando={pulsando}
              deltaPct={deltaPct}
              onDrill={() => tieneHijos && setRuta([...ruta, fila.id])}
              hrefPropio={hrefPropio}
              segmentosHijos={segmentosHijos}
              parametrosAsociados={parametrosAsociados}
              overridesParametros={overridesParametros}
              overridesPartidas={overridesPartidas}
              clavesPulso={clavesPulso}
              onMoverParametro={onMoverParametro}
              onMoverPartida={onMoverPartida}
            />
          );
        })}
      </div>
    </div>
  );
}

function FilaPartida({
  fila,
  info,
  maxCents,
  tieneHijos,
  pulsando,
  deltaPct,
  onDrill,
  hrefPropio,
  segmentosHijos,
  parametrosAsociados,
  overridesParametros,
  overridesPartidas,
  clavesPulso,
  onMoverParametro,
  onMoverPartida,
}: {
  fila: PartidaRow;
  info: PartidaResueltaInfo;
  maxCents: number;
  tieneHijos: boolean;
  pulsando: boolean;
  deltaPct: number | null;
  onDrill: () => void;
  /** D-S11: si la fila es una raíz con página propia, el nombre enlaza ahí en vez de expandir in-place. */
  hrefPropio?: string;
  segmentosHijos: { nombre: string; valor: number; color: string | null }[];
  parametrosAsociados: ParametroRow[];
  overridesParametros: Record<string, number>;
  overridesPartidas: Record<string, number>;
  clavesPulso: Set<string>;
  onMoverParametro: (clave: string, nombre: string, valorNuevo: number) => void;
  onMoverPartida: (id: string, nombre: string, centsNuevo: number) => void;
}) {
  const [abierta, setAbierta] = useState(false);
  const [ajustarAbierto, setAjustarAbierto] = useState(false);
  const pctActual = maxCents > 0 ? Math.min(100, ((info.actual.propioCents ?? 0) / maxCents) * 100) : 0;
  const pctRC = maxCents > 0 ? Math.min(100, ((info.rc.propioCents ?? 0) / maxCents) * 100) : 0;
  const tieneDetalle = Boolean(fila.fuente_actual?.trim() || fila.justificacion_rc?.trim());
  const tieneAjuste = fila.es_palanca || parametrosAsociados.length > 0;

  return (
    <div className={cn('rounded-boton border bg-white p-4', pulsando ? 'pais-pulso border-teal' : 'border-linea')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {hrefPropio ? (
          <Link href={hrefPropio} className="text-left text-[14.5px] font-bold text-titular hover:underline">
            {fila.nombre} <span aria-hidden className="text-gris">→</span>
          </Link>
        ) : tieneHijos ? (
          <button type="button" onClick={onDrill} className="text-left text-[14.5px] font-bold text-titular hover:underline">
            {fila.nombre} <span aria-hidden className="text-gris">→</span>
          </button>
        ) : (
          <span className="text-[14.5px] font-bold text-titular">{fila.nombre}</span>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          {tieneAjuste && (
            <button
              type="button"
              onClick={() => setAjustarAbierto((v) => !v)}
              className="rounded-full bg-accion/10 px-2.5 py-0.5 text-[11px] font-bold text-accion hover:bg-accion/20"
            >
              🎚 {ajustarAbierto ? 'Ocultar palanca' : 'Ajustar'}
            </button>
          )}
          {(info.actual.descuadre || info.rc.descuadre) && (
            <span className="rounded-full bg-naranja/10 px-2.5 py-0.5 text-[11px] font-bold text-naranja">
              ⚠ Descuadre
            </span>
          )}
          {deltaPct !== null && Math.abs(deltaPct) >= 0.5 && (
            <span className="rounded-full bg-teal/10 px-2.5 py-0.5 text-[11px] font-bold text-teal-texto tabular-nums">
              {deltaPct > 0 ? '+' : ''}
              {deltaPct.toFixed(0)}%
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="w-11 shrink-0 text-[11px] font-bold uppercase text-gris">Actual</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-fondo">
            <div
              className="h-full rounded-full bg-[#9aa4b2] transition-[width] duration-500 ease-out"
              style={{ width: `${pctActual}%` }}
            />
          </div>
          <span className="w-24 shrink-0 text-right text-[12.5px] font-semibold text-cuerpo tabular-nums">
            {formatoCorto(info.actual.propioCents)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-11 shrink-0 text-[11px] font-bold uppercase text-teal-texto">RC</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-fondo">
            <div
              className="h-full rounded-full bg-teal transition-[width] duration-500 ease-out"
              style={{ width: `${pctRC}%` }}
            />
          </div>
          <span className="w-24 shrink-0 text-right text-[12.5px] font-semibold text-titular tabular-nums">
            {formatoCorto(info.rc.propioCents)}
          </span>
        </div>
      </div>

      {ajustarAbierto && (
        <div className="mt-3 space-y-2.5 border-t border-linea pt-3">
          {fila.es_palanca && (
            <ControlPalancaPartida
              fila={fila}
              valorActualCents={info.actual.propioCents}
              valorOverrideCents={overridesPartidas[fila.id]}
              pulsando={pulsando}
              onMover={onMoverPartida}
            />
          )}
          {parametrosAsociados.map((p) => (
            <ControlPalancaParametro
              key={p.clave}
              parametro={p}
              valorOverride={overridesParametros[p.clave]}
              pulsando={clavesPulso.has(p.clave)}
              onMover={onMoverParametro}
            />
          ))}
        </div>
      )}

      {(tieneDetalle || tieneHijos) && (
        <div className="mt-2.5">
          <button
            type="button"
            onClick={() => setAbierta((v) => !v)}
            className="text-[12px] font-semibold text-gris hover:text-titular"
          >
            {abierta ? 'Ocultar detalle ▲' : 'Ver detalle ▼'}
          </button>
          {abierta && (
            <div className="mt-2 space-y-3 rounded-boton bg-fondo p-3 text-[12.5px] text-cuerpo">
              {fila.fuente_actual?.trim() && (
                <p>
                  <strong className="text-titular">Fuente (actual):</strong> {fila.fuente_actual}
                </p>
              )}
              {fila.justificacion_rc?.trim() && (
                <p>
                  <strong className="text-teal-texto">Justificación RC:</strong> {fila.justificacion_rc}
                </p>
              )}
              {tieneHijos && segmentosHijos.some((s) => s.valor > 0) && (
                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gris">
                    Reparto de {fila.nombre} — propuesta RC
                  </p>
                  <DonutChart segmentos={segmentosHijos} tamano={112} titulo={fila.nombre} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ControlPalancaParametro({
  parametro,
  valorOverride,
  pulsando,
  onMover,
}: {
  parametro: ParametroRow;
  valorOverride: number | undefined;
  pulsando: boolean;
  onMover: (clave: string, nombre: string, valorNuevo: number) => void;
}) {
  const min = parametro.palanca_min as number;
  const max = parametro.palanca_max as number;
  const valor = clamp(valorOverride ?? parametro.valor_actual ?? min, min, max);
  return (
    <div
      id={`palanca-param-${parametro.clave}`}
      className={cn('rounded-boton border p-3', pulsando ? 'pais-pulso border-teal' : 'border-linea bg-fondo')}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <label htmlFor={`slider-param-${parametro.clave}`} className="text-[13px] font-bold text-titular">
          {parametro.nombre}
        </label>
        <span className="text-[13px] font-semibold text-cuerpo tabular-nums">
          {Math.round(valor).toLocaleString('es-ES')} {parametro.unidad ?? ''}
        </span>
      </div>
      <input
        id={`slider-param-${parametro.clave}`}
        type="range"
        min={min}
        max={max}
        step={pasoRazonable(min, max)}
        value={valor}
        onChange={(e) => onMover(parametro.clave, parametro.nombre, clamp(Number(e.target.value), min, max))}
        className="mt-2 w-full accent-accion"
      />
      <div className="mt-1 flex justify-between text-[11px] text-gris tabular-nums">
        <span>{Math.round(min).toLocaleString('es-ES')}</span>
        <span>{Math.round(max).toLocaleString('es-ES')}</span>
      </div>
    </div>
  );
}

function ControlPalancaPartida({
  fila,
  valorActualCents,
  valorOverrideCents,
  pulsando,
  onMover,
}: {
  fila: PartidaRow;
  valorActualCents: number | null;
  valorOverrideCents: number | undefined;
  pulsando: boolean;
  onMover: (id: string, nombre: string, centsNuevo: number) => void;
}) {
  const minEuros = centsAEuros(fila.palanca_min) as number;
  const maxEuros = centsAEuros(fila.palanca_max) as number;
  // Base = valor YA resuelto por el motor (cubre tanto 'fijo' como
  // 'formula' — leer `fila.actual_cents` a pelo daría null en modo
  // fórmula, aunque no ocurra en la semilla actual).
  const valorCentsActual = valorOverrideCents ?? valorActualCents ?? 0;
  const valorEuros = clamp(centsAEuros(valorCentsActual) as number, minEuros, maxEuros);
  return (
    <div
      id={`palanca-${fila.id}`}
      className={cn('rounded-boton border p-3', pulsando ? 'pais-pulso border-teal' : 'border-linea bg-fondo')}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <label htmlFor={`slider-partida-${fila.id}`} className="text-[13px] font-bold text-titular">
          Ajustar {fila.nombre}
        </label>
        <span className="text-[13px] font-semibold text-cuerpo tabular-nums">
          {formatoCorto(Math.round(valorEuros * 100))}
        </span>
      </div>
      <input
        id={`slider-partida-${fila.id}`}
        type="range"
        min={minEuros}
        max={maxEuros}
        step={pasoRazonable(minEuros, maxEuros)}
        value={valorEuros}
        onChange={(e) => {
          const nuevoEuros = clamp(Number(e.target.value), minEuros, maxEuros);
          onMover(fila.id, fila.nombre, Math.round(nuevoEuros * 100));
        }}
        className="mt-2 w-full accent-accion"
      />
      <div className="mt-1 flex justify-between text-[11px] text-gris tabular-nums">
        <span>{formatoCorto(fila.palanca_min)}</span>
        <span>{formatoCorto(fila.palanca_max)}</span>
      </div>
    </div>
  );
}

/**
 * Mini-sección compacta (S2.1) para las palancas-parámetro que ninguna
 * partida publicada referencia en su fórmula (huérfanas) — así no se
 * pierde ningún control, pero ya NO se reintroduce el bloque grande de
 * "Sandbox de palancas" que había antes con TODO junto.
 */
function PalancasHuerfanas({
  parametros,
  overridesParametros,
  clavesPulso,
  onMoverParametro,
}: {
  parametros: ParametroRow[];
  overridesParametros: Record<string, number>;
  clavesPulso: Set<string>;
  onMoverParametro: (clave: string, nombre: string, valorNuevo: number) => void;
}) {
  if (parametros.length === 0) return null;

  return (
    <section className="mx-auto mt-10 max-w-[1080px] rounded-tarjeta border border-linea bg-white p-5">
      <h2 className="text-[15px] font-extrabold text-titular">Otras palancas</h2>
      <p className="mt-1 max-w-[56ch] text-[12.5px] text-cuerpo">
        Estos parámetros son ajustables pero ninguna partida publicada los usa todavía en su fórmula — de momento
        viven aquí para que no se pierda el control.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 min-[720px]:grid-cols-2">
        {parametros.map((p) => (
          <ControlPalancaParametro
            key={p.clave}
            parametro={p}
            valorOverride={overridesParametros[p.clave]}
            pulsando={clavesPulso.has(p.clave)}
            onMover={onMoverParametro}
          />
        ))}
      </div>
    </section>
  );
}

function CadenaFlotante({ cascada, onVerDesglose }: { cascada: ResultadoCascada; onVerDesglose?: () => void }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pais-cadena-in fixed inset-x-4 bottom-4 z-40 mx-auto max-w-[640px] rounded-boton border border-teal/40 bg-white/95 p-4 shadow-tarjeta backdrop-blur min-[720px]:inset-x-auto min-[720px]:right-6"
    >
      <p className="text-[11.5px] font-bold uppercase tracking-wide text-teal-texto">Efecto en cadena</p>
      <p className="mt-1 text-[13.5px] font-semibold leading-snug text-titular">{cascada.cadenaTexto}</p>
      {onVerDesglose && (
        <button
          type="button"
          onClick={onVerDesglose}
          className="mt-2 text-[12.5px] font-bold text-accion underline underline-offset-2"
        >
          Ver desglose →
        </button>
      )}
    </div>
  );
}
