'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { eliminarEntradas, indexarCerebro, type ResultadoIndexado } from '@/lib/brain/wikiAdmin';
import { cn } from '@/lib/cn';

export interface FilaEntrada {
  id: string;
  title: string;
  categoria: string;
  area: { name: string; color: string } | null;
  visibility: 'internal' | 'public';
  indexado: boolean;
  tieneSimulador: boolean;
  autor: string | null;
  actualizado: string;
}

interface Props {
  filas: FilaEntrada[];
  categorias: { slug: string; name: string }[];
  areas: { id: number; name: string; color: string }[];
  q: string;
  categoriaSlug: string;
  areaId: string;
  page: number;
  per: number;
  total: number;
  totalPaginas: number;
  tamanos: number[];
}

/** Ventana compacta de páginas: 1 … 4 5 6 … 12 */
function paginasVisibles(actual: number, total: number): (number | '…')[] {
  const candidatos = [1, total, actual - 1, actual, actual + 1];
  const ordenadas = [...new Set(candidatos)].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const salida: (number | '…')[] = [];
  let previa = 0;
  for (const n of ordenadas) {
    if (n - previa > 1) salida.push('…');
    salida.push(n);
    previa = n;
  }
  return salida;
}

/** Chip de área temática (departamento del blog), con su color de marca. */
function AreaChip({ area }: { area: { name: string; color: string } }) {
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-[11.5px] font-bold text-white"
      style={{ backgroundColor: area.color }}
    >
      {area.name}
    </span>
  );
}

/** Interno / Público — quién puede acabar viendo esta entrada. */
function VisibilidadChip({ visibility }: { visibility: 'internal' | 'public' }) {
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-0.5 text-[11.5px] font-bold',
        visibility === 'public' ? 'bg-teal/15 text-teal' : 'bg-gris/15 text-gris',
      )}
    >
      {visibility === 'public' ? 'Público' : 'Interno'}
    </span>
  );
}

/**
 * Estado de indexado en `brain_documents` (lo rellena la ingesta de rc-08).
 * Check verde = está en el cerebro; X roja = pendiente de indexar.
 */
function EstadoCerebro({ indexado }: { indexado: boolean }) {
  const etiqueta = indexado ? 'En el cerebro' : 'Pendiente de indexar';
  return (
    <span className="inline-flex items-center" title={etiqueta} aria-label={etiqueta} role="img">
      {indexado ? (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" className="fill-green-600" />
          <path
            d="M8.5 12.2l2.3 2.3 4.7-4.9"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" className="fill-red-600" />
          <path d="M9 9l6 6M15 9l-6 6" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
    </span>
  );
}

/** Distintivo de "tiene simulador HTML adjunto" (0027). */
function SimuladorChip() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-morado/12 px-2 py-0.5 text-[11px] font-bold text-morado"
      title="Esta entrada tiene un simulador interactivo"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 14l5-5 4 4 7-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Simulador
    </span>
  );
}

/**
 * Botón "Indexar al cerebro" + contador de pendientes.
 *
 * `pendientes` cuenta TODAS las entradas sin `indexed_at` (no solo las del
 * filtro activo del listado) -- viene de una query aparte en la page, así el
 * contador no se mueve al buscar/filtrar. `router.refresh()` tras un éxito
 * revalida el server component: el estado de cada fila y este contador quedan
 * al día.
 */
export function IndexarBarra({ pendientes }: { pendientes: number }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [resultado, setResultado] = useState<ResultadoIndexado | null>(null);
  const [mostrarForzar, setMostrarForzar] = useState(false);

  function ejecutar(mode: 'pending' | 'all') {
    setResultado(null);
    iniciar(async () => {
      const r = await indexarCerebro(mode);
      setResultado(r);
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="mb-4 rounded-tarjeta border border-linea bg-white p-4">
      <div className="flex flex-col gap-3 min-[720px]:flex-row min-[720px]:items-center min-[720px]:justify-between">
        <span
          className={cn(
            'w-fit rounded-full px-2.5 py-0.5 text-[11.5px] font-bold',
            pendientes > 0 ? 'bg-naranja/15 text-naranja' : 'bg-accion/10 text-accion',
          )}
        >
          {pendientes > 0
            ? `${pendientes} entrada${pendientes === 1 ? '' : 's'} pendiente${pendientes === 1 ? '' : 's'} de indexar`
            : 'Todo el cerebro está indexado'}
        </span>

        <div className="flex flex-wrap items-center gap-3">
          {mostrarForzar && (
            <button
              type="button"
              onClick={() => ejecutar('all')}
              disabled={pendiente}
              className="rounded-boton border border-linea bg-white px-3 py-2 text-[13px] font-semibold text-gris hover:border-titular disabled:opacity-50"
            >
              Reindexar todo
            </button>
          )}
          <button
            type="button"
            onClick={() => setMostrarForzar((v) => !v)}
            className="text-[12.5px] font-semibold text-gris underline decoration-dotted underline-offset-2 hover:text-titular"
          >
            {mostrarForzar ? 'ocultar' : 'forzar reindexado completo'}
          </button>
          <button
            type="button"
            onClick={() => ejecutar('pending')}
            disabled={pendiente || pendientes === 0}
            className="rounded-boton bg-accion px-4 py-2 text-[13.5px] font-bold text-white shadow-boton transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            {pendiente ? 'Indexando…' : 'Indexar al cerebro'}
          </button>
        </div>
      </div>

      {resultado && (
        <p
          className={cn(
            'mt-3 text-[13px] font-semibold',
            resultado.ok ? 'text-accion' : 'text-magenta',
          )}
        >
          {resultado.ok
            ? `Indexadas ${resultado.entries_indexed ?? 0} entrada${resultado.entries_indexed === 1 ? '' : 's'} (${resultado.chunks_inserted ?? 0} fragmento${resultado.chunks_inserted === 1 ? '' : 's'}).` +
              (resultado.skipped
                ? ` ${resultado.skipped} entrada${resultado.skipped === 1 ? '' : 's'} se saltaron por texto corrupto — revísalas.`
                : '')
            : resultado.error}
        </p>
      )}
    </div>
  );
}

export function CerebroClient({
  filas,
  categorias,
  areas,
  q,
  categoriaSlug,
  areaId,
  page,
  per,
  total,
  totalPaginas,
  tamanos,
}: Props) {
  const router = useRouter();

  const [montado, setMontado] = useState(false);
  const [busqueda, setBusqueda] = useState(q);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  useEffect(() => setMontado(true), []);

  // Al cambiar de filtro/búsqueda/página/tamaño, la selección deja de ser válida.
  useEffect(() => setSeleccion(new Set()), [q, categoriaSlug, areaId, per, page]);

  function navegar(cambios: { q?: string; categoria?: string; area?: string; page?: number; per?: number }) {
    const params = new URLSearchParams();
    const nq = cambios.q !== undefined ? cambios.q : q;
    const ncat = cambios.categoria !== undefined ? cambios.categoria : categoriaSlug;
    const narea = cambios.area !== undefined ? cambios.area : areaId;
    const nper = cambios.per !== undefined ? cambios.per : per;
    // Cualquier cambio de filtro/tamaño vuelve a la página 1 salvo que se pida
    // explícitamente otra página.
    const npage = cambios.page !== undefined ? cambios.page : 1;
    if (nq) params.set('q', nq);
    if (ncat) params.set('categoria', ncat);
    if (narea) params.set('area', narea);
    if (nper !== 25) params.set('per', String(nper));
    if (npage > 1) params.set('page', String(npage));
    const qs = params.toString();
    router.push(qs ? `/admin/cerebro?${qs}` : '/admin/cerebro');
  }

  // Búsqueda con debounce (400 ms). Solo navega si el texto cambió respecto a la URL.
  useEffect(() => {
    if (busqueda.trim() === q) return;
    const t = setTimeout(() => navegar({ q: busqueda.trim(), page: 1 }), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda]);

  const todosMarcados = filas.length > 0 && filas.every((f) => seleccion.has(f.id));

  function alternarTodos() {
    setSeleccion((prev) => {
      const n = new Set(prev);
      if (filas.every((f) => n.has(f.id))) filas.forEach((f) => n.delete(f.id));
      else filas.forEach((f) => n.add(f.id));
      return n;
    });
  }

  function alternar(id: string) {
    setSeleccion((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function confirmarEliminar() {
    setError(null);
    const ids = Array.from(seleccion);
    iniciar(async () => {
      try {
        const r = await eliminarEntradas(ids);
        if (!r.ok) {
          setError(r.error ?? 'No se han podido eliminar.');
          setConfirmando(false);
          return;
        }
        setConfirmando(false);
        const quedan = filas.filter((f) => !seleccion.has(f.id)).length;
        setSeleccion(new Set());
        if (quedan <= 0 && page > 1) navegar({ page: page - 1 });
        else router.refresh();
      } catch {
        setError('No se han podido eliminar (error de red o servidor). Inténtalo de nuevo.');
        setConfirmando(false);
      }
    });
  }

  const desde = total === 0 ? 0 : (page - 1) * per + 1;
  const hasta = Math.min(page * per, total);
  const hayFiltro = Boolean(q || categoriaSlug || areaId);

  return (
    <div>
      {/* Barra de herramientas: buscador + filtros de categoría/área + tamaño */}
      <div className="mb-4 flex flex-col gap-3 min-[860px]:flex-row min-[860px]:flex-wrap min-[860px]:items-center">
        <div className="relative min-[860px]:w-[280px]">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gris"
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M20 20l-3.2-3.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar entradas…"
            aria-label="Buscar entradas"
            className="w-full rounded-boton border border-linea bg-white py-2.5 pl-10 pr-3 text-[14px] text-titular outline-none placeholder:text-gris focus:border-accion"
          />
        </div>

        <select
          value={categoriaSlug}
          onChange={(e) => navegar({ categoria: e.target.value, page: 1 })}
          aria-label="Filtrar por categoría"
          className="rounded-boton border border-linea bg-white py-2.5 pl-3 pr-8 text-[13.5px] font-semibold text-titular outline-none focus:border-accion"
        >
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={areaId}
          onChange={(e) => navegar({ area: e.target.value, page: 1 })}
          aria-label="Filtrar por área temática"
          className="rounded-boton border border-linea bg-white py-2.5 pl-3 pr-8 text-[13.5px] font-semibold text-titular outline-none focus:border-accion"
        >
          <option value="">Todas las áreas</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-[13px] text-gris min-[860px]:ml-auto">
          Mostrar
          <select
            value={per}
            onChange={(e) => navegar({ per: Number(e.target.value), page: 1 })}
            className="rounded-boton border border-linea bg-white py-2 pl-3 pr-8 text-[13.5px] font-semibold text-titular outline-none focus:border-accion"
          >
            {tamanos.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <p className="mb-3 rounded-boton border border-magenta/40 bg-magenta/5 px-4 py-2.5 text-[13.5px] font-semibold text-magenta">
          {error}
        </p>
      )}

      {/* Barra de acción de selección */}
      {seleccion.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-boton border border-magenta/30 bg-magenta/5 px-4 py-2.5">
          <span className="text-[13.5px] font-semibold text-titular">
            {seleccion.size} entrada{seleccion.size === 1 ? '' : 's'} seleccionada
            {seleccion.size === 1 ? '' : 's'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSeleccion(new Set())}
              className="rounded-boton px-3 py-1.5 text-[13px] font-semibold text-gris hover:text-titular"
            >
              Quitar selección
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(true)}
              className="rounded-boton bg-magenta px-4 py-1.5 text-[13px] font-bold text-white transition-transform hover:-translate-y-0.5"
            >
              Eliminar ({seleccion.size})
            </button>
          </div>
        </div>
      )}

      {filas.length === 0 ? (
        <p className="rounded-tarjeta border border-linea bg-white p-6 text-cuerpo">
          {hayFiltro
            ? 'No hay entradas que coincidan con el filtro.'
            : 'Todavía no hay entradas en el cerebro. Crea la primera.'}
        </p>
      ) : (
        <>
          {/* Móvil: tarjetas apiladas con checkbox */}
          <ul className="overflow-hidden rounded-tarjeta border border-linea bg-white min-[720px]:hidden">
            {filas.map((f, i) => {
              const marcado = seleccion.has(f.id);
              return (
                <li
                  key={f.id}
                  className={cn(
                    'flex items-start gap-3 border-b border-linea/60 p-4 last:border-0',
                    marcado ? 'bg-accion/5' : i % 2 === 1 ? 'bg-fondo' : 'bg-white',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={marcado}
                    onChange={() => alternar(f.id)}
                    aria-label={`Seleccionar ${f.title}`}
                    className="mt-1 h-[18px] w-[18px] shrink-0 accent-accion"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/admin/cerebro/${f.id}`}
                        className="block text-[15.5px] font-bold leading-snug text-titular no-underline hover:underline"
                      >
                        {f.title}
                      </Link>
                      <EstadoCerebro indexado={f.indexado} />
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-white px-2.5 py-0.5 text-[11.5px] font-semibold text-cuerpo ring-1 ring-linea">
                        {f.categoria}
                      </span>
                      <VisibilidadChip visibility={f.visibility} />
                      {f.area && <AreaChip area={f.area} />}
                      {f.tieneSimulador && <SimuladorChip />}
                    </div>
                    <p className="mt-1.5 truncate text-[12.5px] text-gris">
                      {[f.autor, f.actualizado].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Escritorio: tabla completa con checkboxes */}
          <div className="hidden overflow-x-auto rounded-tarjeta border border-linea bg-white min-[720px]:block">
            <table className="w-full min-w-[860px] border-collapse text-left text-[15px]">
              <thead>
                <tr className="border-b border-linea text-[13px] uppercase tracking-[.08em] text-gris">
                  <th className="w-[44px] px-4 py-4">
                    <input
                      type="checkbox"
                      checked={todosMarcados}
                      ref={(el) => {
                        if (el) el.indeterminate = !todosMarcados && filas.some((f) => seleccion.has(f.id));
                      }}
                      onChange={alternarTodos}
                      aria-label="Seleccionar todos"
                      className="h-[18px] w-[18px] accent-accion align-middle"
                    />
                  </th>
                  <th className="px-4 py-4 font-bold">Título</th>
                  <th className="px-4 py-4 font-bold">Categoría</th>
                  <th className="px-4 py-4 font-bold">Área</th>
                  <th className="px-4 py-4 font-bold">Visibilidad</th>
                  <th className="w-[90px] px-4 py-4 text-center font-bold">Cerebro</th>
                  <th className="px-4 py-4 font-bold">Autor</th>
                  <th className="px-4 py-4 font-bold">Actualizado</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f, i) => {
                  const marcado = seleccion.has(f.id);
                  return (
                    <tr
                      key={f.id}
                      className={cn(
                        'border-b border-linea/60 last:border-0',
                        marcado ? 'bg-accion/5' : i % 2 === 1 ? 'bg-fondo' : 'bg-white',
                      )}
                    >
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={marcado}
                          onChange={() => alternar(f.id)}
                          aria-label={`Seleccionar ${f.title}`}
                          className="h-[18px] w-[18px] accent-accion align-middle"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/admin/cerebro/${f.id}`}
                            className="font-bold text-titular no-underline hover:underline"
                          >
                            {f.title}
                          </Link>
                          {f.tieneSimulador && <SimuladorChip />}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-cuerpo">{f.categoria}</td>
                      <td className="px-4 py-4">
                        {f.area ? <AreaChip area={f.area} /> : <span className="text-gris">—</span>}
                      </td>
                      <td className="px-4 py-4">
                        <VisibilidadChip visibility={f.visibility} />
                      </td>
                      <td className="px-4 py-4 text-center">
                        <EstadoCerebro indexado={f.indexado} />
                      </td>
                      <td className="px-4 py-4 text-cuerpo">{f.autor ?? '—'}</td>
                      <td className="px-4 py-4 text-cuerpo">{f.actualizado}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Pie: recuento + paginador */}
      {total > 0 && (
        <div className="mt-4 flex flex-col items-center justify-between gap-3 min-[560px]:flex-row">
          <p className="text-[13px] text-gris">
            {desde}–{hasta} de {total}
          </p>
          {totalPaginas > 1 && (
            <nav className="flex items-center gap-1" aria-label="Paginación">
              <button
                type="button"
                onClick={() => navegar({ page: page - 1 })}
                disabled={page <= 1}
                aria-label="Página anterior"
                className="grid h-9 w-9 place-items-center rounded-boton border border-linea bg-white text-titular disabled:opacity-40 enabled:hover:border-titular"
              >
                ‹
              </button>
              {paginasVisibles(page, totalPaginas).map((n, i) =>
                n === '…' ? (
                  <span key={`e${i}`} className="px-1.5 text-gris">
                    …
                  </span>
                ) : (
                  <button
                    key={n}
                    type="button"
                    onClick={() => navegar({ page: n })}
                    aria-current={n === page ? 'page' : undefined}
                    className={cn(
                      'grid h-9 min-w-9 place-items-center rounded-boton border px-2 text-[13.5px] font-semibold',
                      n === page
                        ? 'border-accion bg-accion text-white'
                        : 'border-linea bg-white text-titular hover:border-titular',
                    )}
                  >
                    {n}
                  </button>
                ),
              )}
              <button
                type="button"
                onClick={() => navegar({ page: page + 1 })}
                disabled={page >= totalPaginas}
                aria-label="Página siguiente"
                className="grid h-9 w-9 place-items-center rounded-boton border border-linea bg-white text-titular disabled:opacity-40 enabled:hover:border-titular"
              >
                ›
              </button>
            </nav>
          )}
        </div>
      )}

      {/* Modal de confirmación de borrado (portal a <body>) */}
      {confirmando &&
        montado &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Confirmar eliminación"
            className="fixed inset-0 z-[70] flex items-center justify-center bg-noche/40 p-4"
            onClick={() => !pendiente && setConfirmando(false)}
          >
            <div
              className="w-full max-w-md rounded-tarjeta border border-linea bg-white p-6 shadow-nav motion-safe:animate-[sube_.25s_ease]"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-[19px] font-bold text-titular">
                ¿Eliminar {seleccion.size} entrada{seleccion.size === 1 ? '' : 's'}?
              </h2>
              <p className="mt-2 text-[14px] text-cuerpo">
                Esta acción no se puede deshacer. Se eliminarán de forma permanente del cerebro.
              </p>
              <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-[13px] text-gris">
                {filas
                  .filter((f) => seleccion.has(f.id))
                  .slice(0, 8)
                  .map((f) => (
                    <li key={f.id} className="truncate">
                      • {f.title}
                    </li>
                  ))}
                {seleccion.size > 8 && <li className="text-gris">…y {seleccion.size - 8} más</li>}
              </ul>
              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmando(false)}
                  disabled={pendiente}
                  className="rounded-boton border border-linea bg-white px-4 py-2 text-[14px] font-bold text-titular hover:border-titular disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmarEliminar}
                  disabled={pendiente}
                  className="rounded-boton bg-magenta px-4 py-2 text-[14px] font-bold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60"
                >
                  {pendiente ? 'Eliminando…' : 'Eliminar'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
