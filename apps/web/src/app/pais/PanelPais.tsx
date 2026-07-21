'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import type { ParametroRow, PartidaRow } from '@/lib/simulador/adminData';
import { centsAEuros, formatoEuros } from '@/lib/simulador/formato';
import { resolver } from '@/lib/simulador/resolver';
import type { ModeloResuelto, Overrides, PartidaResueltaInfo, TipoPartida } from '@/lib/simulador/tipos';
import { CountUp } from './CountUp';
import { detectarCascada, type ResultadoCascada } from './cascada';

interface Props {
  parametros: ParametroRow[];
  partidas: PartidaRow[];
  beta: boolean;
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

export function PanelPais({ parametros, partidas, beta }: Props) {
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

  return (
    <div>
      <Cabecera modelo={modelo} beta={beta} />

      <div className="mx-auto mt-12 grid max-w-[1080px] grid-cols-1 gap-8 min-[900px]:grid-cols-2">
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
              idsPulso={cascada?.idsPulso ?? new Set()}
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
              idsPulso={cascada?.idsPulso ?? new Set()}
            />
          </div>
        </section>
      </div>

      <Sandbox
        parametros={parametros}
        partidas={partidas}
        infoPorId={infoPorId}
        overridesParametros={overridesParametros}
        overridesPartidas={overridesPartidas}
        clavesPulso={cascada?.clavesPulso ?? new Set()}
        idsPulso={cascada?.idsPulso ?? new Set()}
        hayOverrides={hayOverrides}
        onMoverParametro={moverParametro}
        onMoverPartida={moverPartida}
        onRestablecer={restablecer}
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
    <header className="mx-auto max-w-[900px] text-center">
      <span className="text-[13px] font-bold uppercase tracking-[.14em] text-titular">
        Base de datos del país
      </span>
      <h1 className="mt-3 text-[clamp(28px,4vw,44px)] font-extrabold leading-[1.12]">
        El Presupuesto del País
      </h1>
      <p className="mx-auto mt-3 max-w-[62ch] text-[15.5px] text-cuerpo">
        El presupuesto oficial de España, comparado con el de Razón Común — área a área, con fuente oficial y
        justificación política. Mueve las palancas del sandbox y mira el efecto en cadena.
      </p>

      {beta && (
        <p className="mx-auto mt-4 inline-block rounded-full border border-naranja/40 bg-naranja/10 px-4 py-1.5 text-[12.5px] font-bold text-naranja">
          🚧 Beta — en construcción: cada semana publicamos más áreas
        </p>
      )}

      <div className="mx-auto mt-8 grid max-w-[560px] grid-cols-1 gap-4 min-[520px]:grid-cols-2">
        <div className="rounded-tarjeta border border-linea bg-white p-5">
          <p className="text-[12px] font-bold uppercase tracking-wide text-gris">Balance actual (oficial)</p>
          <p
            className={cn(
              'mt-1 text-[28px] font-extrabold tabular-nums',
              modelo.balance.actualCents >= 0 ? 'text-titular' : 'text-magenta',
            )}
          >
            <CountUp value={modelo.balance.actualCents} formatear={(n) => formatoEuros(Math.round(n))} />
          </p>
        </div>
        <div className="rounded-tarjeta border border-teal/30 bg-teal/5 p-5">
          <p className="text-[12px] font-bold uppercase tracking-wide text-teal-texto">Balance Razón Común</p>
          <p
            className={cn(
              'mt-1 text-[28px] font-extrabold tabular-nums',
              modelo.balance.rcCents >= 0 ? 'text-teal-texto' : 'text-magenta',
            )}
          >
            <CountUp value={modelo.balance.rcCents} formatear={(n) => formatoEuros(Math.round(n))} />
          </p>
        </div>
      </div>

      {modelo.sinResolver.length > 0 && (
        <p className="mx-auto mt-3 max-w-[62ch] text-[12.5px] text-gris">
          ⚠ {modelo.sinResolver.length} elemento{modelo.sinResolver.length === 1 ? '' : 's'} publicado
          {modelo.sinResolver.length === 1 ? '' : 's'} sin resolver — no cuenta
          {modelo.sinResolver.length === 1 ? '' : 'n'} en el balance.
        </p>
      )}
    </header>
  );
}

function Bloque({
  tipo,
  ruta,
  setRuta,
  partidas,
  partidaPorId,
  infoPorId,
  hijosDe,
  idsPulso,
}: {
  tipo: TipoPartida;
  ruta: string[];
  setRuta: (r: string[]) => void;
  partidas: PartidaRow[];
  partidaPorId: Map<string, PartidaRow>;
  infoPorId: Map<string, PartidaResueltaInfo>;
  hijosDe: Map<string, string[]>;
  idsPulso: Set<string>;
}) {
  const nivelActualId = ruta.length > 0 ? ruta[ruta.length - 1] : null;
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

  return (
    <div>
      <nav aria-label="Ruta de navegación" className="mb-3 flex flex-wrap items-center gap-1 text-[12.5px] text-gris">
        <button
          type="button"
          onClick={() => setRuta([])}
          className={cn('font-bold', ruta.length === 0 ? 'text-titular' : 'hover:text-titular')}
        >
          {tipo === 'gasto' ? 'Gastos' : 'Ingresos'}
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
          const tieneHijos = (hijosDe.get(fila.id) ?? []).length > 0;
          const pulsando = idsPulso.has(fila.id);
          const deltaPct =
            info.actual.propioCents !== null && info.actual.propioCents !== 0 && info.rc.propioCents !== null
              ? ((info.rc.propioCents - info.actual.propioCents) / Math.abs(info.actual.propioCents)) * 100
              : null;

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
}: {
  fila: PartidaRow;
  info: PartidaResueltaInfo;
  maxCents: number;
  tieneHijos: boolean;
  pulsando: boolean;
  deltaPct: number | null;
  onDrill: () => void;
}) {
  const [abierta, setAbierta] = useState(false);
  const pctActual = maxCents > 0 ? Math.min(100, ((info.actual.propioCents ?? 0) / maxCents) * 100) : 0;
  const pctRC = maxCents > 0 ? Math.min(100, ((info.rc.propioCents ?? 0) / maxCents) * 100) : 0;
  const tieneDetalle = Boolean(fila.fuente_actual?.trim() || fila.justificacion_rc?.trim());

  return (
    <div className={cn('rounded-boton border bg-white p-4', pulsando ? 'pais-pulso border-teal' : 'border-linea')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {tieneHijos ? (
          <button type="button" onClick={onDrill} className="text-left text-[14.5px] font-bold text-titular hover:underline">
            {fila.nombre} <span aria-hidden className="text-gris">→</span>
          </button>
        ) : (
          <span className="text-[14.5px] font-bold text-titular">{fila.nombre}</span>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          {fila.es_palanca && (
            <a
              href={`#palanca-${fila.id}`}
              className="rounded-full bg-accion/10 px-2.5 py-0.5 text-[11px] font-bold text-accion no-underline hover:bg-accion/20"
            >
              🎚 Palanca
            </a>
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
            {formatoEuros(info.actual.propioCents)}
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
            {formatoEuros(info.rc.propioCents)}
          </span>
        </div>
      </div>

      {tieneDetalle && (
        <div className="mt-2.5">
          <button
            type="button"
            onClick={() => setAbierta((v) => !v)}
            className="text-[12px] font-semibold text-gris hover:text-titular"
          >
            {abierta ? 'Ocultar fuente ▲' : 'Ver fuente y justificación ▼'}
          </button>
          {abierta && (
            <div className="mt-2 space-y-1.5 rounded-boton bg-fondo p-3 text-[12.5px] text-cuerpo">
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
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Sandbox({
  parametros,
  partidas,
  infoPorId,
  overridesParametros,
  overridesPartidas,
  clavesPulso,
  idsPulso,
  hayOverrides,
  onMoverParametro,
  onMoverPartida,
  onRestablecer,
}: {
  parametros: ParametroRow[];
  partidas: PartidaRow[];
  infoPorId: Map<string, PartidaResueltaInfo>;
  overridesParametros: Record<string, number>;
  overridesPartidas: Record<string, number>;
  clavesPulso: Set<string>;
  idsPulso: Set<string>;
  hayOverrides: boolean;
  onMoverParametro: (clave: string, nombre: string, valorNuevo: number) => void;
  onMoverPartida: (id: string, nombre: string, centsNuevo: number) => void;
  onRestablecer: () => void;
}) {
  const palancasParam = parametros.filter((p) => p.es_palanca && p.palanca_min !== null && p.palanca_max !== null);
  const palancasPartida = partidas.filter((p) => p.es_palanca && p.palanca_min !== null && p.palanca_max !== null);

  if (palancasParam.length === 0 && palancasPartida.length === 0) return null;

  return (
    <section id="sandbox-palancas" className="mx-auto mt-10 max-w-[1080px] rounded-tarjeta border border-linea bg-white p-5 min-[720px]:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-extrabold text-titular">Sandbox de palancas</h2>
          <p className="mt-1 max-w-[56ch] text-[13px] text-cuerpo">
            Mueve estos valores y mira cómo se recalcula todo al momento, en tu navegador — no se envía nada al
            servidor ni se guarda en ningún sitio.
          </p>
        </div>
        {hayOverrides && (
          <button
            type="button"
            onClick={onRestablecer}
            className="shrink-0 rounded-boton border border-linea bg-white px-4 py-2 text-[13px] font-bold text-titular hover:border-titular"
          >
            Restablecer
          </button>
        )}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 min-[720px]:grid-cols-2">
        {palancasParam.map((p) => {
          const min = p.palanca_min as number;
          const max = p.palanca_max as number;
          const valor = clamp(overridesParametros[p.clave] ?? p.valor_actual ?? min, min, max);
          const pulsando = clavesPulso.has(p.clave);
          return (
            <div
              id={`palanca-${p.clave}`}
              key={p.clave}
              className={cn('rounded-boton border p-4', pulsando ? 'pais-pulso border-teal' : 'border-linea')}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <label htmlFor={`slider-param-${p.clave}`} className="text-[13.5px] font-bold text-titular">
                  {p.nombre}
                </label>
                <span className="text-[13.5px] font-semibold text-cuerpo tabular-nums">
                  {Math.round(valor).toLocaleString('es-ES')} {p.unidad ?? ''}
                </span>
              </div>
              <input
                id={`slider-param-${p.clave}`}
                type="range"
                min={min}
                max={max}
                step={pasoRazonable(min, max)}
                value={valor}
                onChange={(e) => onMoverParametro(p.clave, p.nombre, clamp(Number(e.target.value), min, max))}
                className="mt-2 w-full accent-accion"
              />
              <div className="mt-1 flex justify-between text-[11px] text-gris tabular-nums">
                <span>{Math.round(min).toLocaleString('es-ES')}</span>
                <span>{Math.round(max).toLocaleString('es-ES')}</span>
              </div>
            </div>
          );
        })}

        {palancasPartida.map((p) => {
          const minEuros = centsAEuros(p.palanca_min) as number;
          const maxEuros = centsAEuros(p.palanca_max) as number;
          // Base = valor YA resuelto por el motor (cubre tanto 'fijo' como
          // 'formula' — leer `p.actual_cents` a pelo daría null en modo
          // fórmula, aunque no ocurra en la semilla actual).
          const valorCentsActual = overridesPartidas[p.id] ?? infoPorId.get(p.id)?.actual.propioCents ?? 0;
          const valorEuros = clamp(centsAEuros(valorCentsActual) as number, minEuros, maxEuros);
          const pulsando = idsPulso.has(p.id);
          return (
            <div
              id={`palanca-${p.id}`}
              key={p.id}
              className={cn('rounded-boton border p-4', pulsando ? 'pais-pulso border-teal' : 'border-linea')}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <label htmlFor={`slider-partida-${p.id}`} className="text-[13.5px] font-bold text-titular">
                  {p.nombre}
                </label>
                <span className="text-[13.5px] font-semibold text-cuerpo tabular-nums">
                  {formatoEuros(Math.round(valorEuros * 100))}
                </span>
              </div>
              <input
                id={`slider-partida-${p.id}`}
                type="range"
                min={minEuros}
                max={maxEuros}
                step={pasoRazonable(minEuros, maxEuros)}
                value={valorEuros}
                onChange={(e) => {
                  const nuevoEuros = clamp(Number(e.target.value), minEuros, maxEuros);
                  onMoverPartida(p.id, p.nombre, Math.round(nuevoEuros * 100));
                }}
                className="mt-2 w-full accent-accion"
              />
              <div className="mt-1 flex justify-between text-[11px] text-gris tabular-nums">
                <span>{formatoEuros(p.palanca_min)}</span>
                <span>{formatoEuros(p.palanca_max)}</span>
              </div>
            </div>
          );
        })}
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
