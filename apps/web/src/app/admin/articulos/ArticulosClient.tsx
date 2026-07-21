'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { eliminarArticulos } from '@/lib/blog/admin';
import { cn } from '@/lib/cn';

export interface FilaArticulo {
  id: string;
  title: string;
  status: 'draft' | 'published';
  seccion: string;
  categoria: string;
  autor: string | null;
  portada: string | null;
  publicado: string;
}

interface Props {
  filas: FilaArticulo[];
  total: number;
  page: number;
  per: number;
  q: string;
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

/** Miniatura de portada (o placeholder neutro si el artículo no tiene). */
function Miniatura({ src, alt, size }: { src: string | null; alt: string; size: number }) {
  if (!src) {
    return (
      <div
        className="grid shrink-0 place-items-center rounded-boton border border-linea bg-fondo text-gris"
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <svg width={Math.round(size * 0.42)} height={Math.round(size * 0.42)} viewBox="0 0 24 24" fill="none">
          <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="8.5" cy="9.5" r="1.5" fill="currentColor" />
          <path
            d="M5 18l4.5-4 3 2.5L16 13l3 3.2"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className="shrink-0 rounded-boton border border-linea object-cover"
      style={{ width: size, height: size }}
    />
  );
}

/** Estado como chip con fondo (mismo lenguaje visual que las demás tags). */
function EstadoChip({ status }: { status: 'draft' | 'published' }) {
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-0.5 text-[11.5px] font-bold',
        status === 'published' ? 'bg-accion/10 text-accion' : 'bg-gris/15 text-gris',
      )}
    >
      {status === 'published' ? 'Publicado' : 'Borrador'}
    </span>
  );
}

export function ArticulosClient({ filas, total, page, per, q, totalPaginas, tamanos }: Props) {
  const router = useRouter();

  const [montado, setMontado] = useState(false);
  const [busqueda, setBusqueda] = useState(q);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  useEffect(() => setMontado(true), []);

  // Al cambiar de página / búsqueda / tamaño, la selección deja de ser válida.
  useEffect(() => setSeleccion(new Set()), [q, per, page]);

  function navegar(cambios: { q?: string; page?: number; per?: number }) {
    const params = new URLSearchParams();
    const nq = cambios.q !== undefined ? cambios.q : q;
    const nper = cambios.per !== undefined ? cambios.per : per;
    const npage = cambios.page !== undefined ? cambios.page : page;
    if (nq) params.set('q', nq);
    if (nper !== 25) params.set('per', String(nper));
    if (npage > 1) params.set('page', String(npage));
    const qs = params.toString();
    router.push(qs ? `/admin/articulos?${qs}` : '/admin/articulos');
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
        const r = await eliminarArticulos(ids);
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
        // Red de seguridad: aunque el server action ya devuelve el error en el
        // objeto en vez de lanzar, un fallo de red del propio RPC podría rechazar
        // la promesa. Se muestra inline en vez de dejar caer la página entera.
        setError('No se han podido eliminar (error de red o servidor). Inténtalo de nuevo.');
        setConfirmando(false);
      }
    });
  }

  const desde = total === 0 ? 0 : (page - 1) * per + 1;
  const hasta = Math.min(page * per, total);

  return (
    <div>
      {/* Barra de herramientas: buscador + tamaño de página */}
      <div className="mb-4 flex flex-col gap-3 min-[720px]:flex-row min-[720px]:items-center min-[720px]:justify-between">
        <div className="relative min-[720px]:w-[340px]">
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
            placeholder="Buscar artículos…"
            aria-label="Buscar artículos"
            className="w-full rounded-boton border border-linea bg-white py-2.5 pl-10 pr-3 text-[14px] text-titular outline-none placeholder:text-gris focus:border-accion"
          />
        </div>

        <label className="flex items-center gap-2 text-[13px] text-gris">
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
          <span className="hidden min-[420px]:inline">por página</span>
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
            {seleccion.size} artículo{seleccion.size === 1 ? '' : 's'} seleccionado
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
          {q ? `No hay artículos que coincidan con «${q}».` : 'Todavía no hay artículos. Crea el primero.'}
        </p>
      ) : (
        <>
          {/* Móvil: tarjetas apiladas con checkbox */}
          <ul className="overflow-hidden rounded-tarjeta border border-linea bg-white min-[720px]:hidden">
            {filas.map((a, i) => {
              const marcado = seleccion.has(a.id);
              return (
                <li
                  key={a.id}
                  className={cn(
                    'flex items-start gap-3 border-b border-linea/60 p-4 last:border-0',
                    marcado ? 'bg-accion/5' : i % 2 === 1 ? 'bg-fondo' : 'bg-white',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={marcado}
                    onChange={() => alternar(a.id)}
                    aria-label={`Seleccionar ${a.title}`}
                    className="mt-1 h-[18px] w-[18px] shrink-0 accent-accion"
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/articulos/${a.id}`}
                      className="block text-[15.5px] font-bold leading-snug text-titular no-underline hover:underline"
                    >
                      {a.title}
                    </Link>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-gris">
                      <EstadoChip status={a.status} />
                      <span className="truncate">
                        {[a.autor, a.publicado].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
                      <span className="rounded-full bg-white px-2.5 py-0.5 font-semibold text-cuerpo ring-1 ring-linea">
                        {a.categoria}
                      </span>
                      <span className="rounded-full bg-white px-2.5 py-0.5 font-semibold text-cuerpo ring-1 ring-linea">
                        {a.seccion}
                      </span>
                    </div>
                  </div>
                  <Miniatura src={a.portada} alt={a.title} size={56} />
                </li>
              );
            })}
          </ul>

          {/* Escritorio: tabla completa con checkboxes */}
          <div className="hidden overflow-x-auto rounded-tarjeta border border-linea bg-white min-[720px]:block">
            <table className="w-full min-w-[820px] border-collapse text-left text-[15px]">
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
                  <th className="px-4 py-4 font-bold">Sección</th>
                  <th className="px-4 py-4 font-bold">Autor</th>
                  <th className="px-4 py-4 font-bold">Estado</th>
                  <th className="px-4 py-4 font-bold">Publicado</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((a, i) => {
                  const marcado = seleccion.has(a.id);
                  return (
                    <tr
                      key={a.id}
                      className={cn(
                        'border-b border-linea/60 last:border-0',
                        marcado ? 'bg-accion/5' : i % 2 === 1 ? 'bg-fondo' : 'bg-white',
                      )}
                    >
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={marcado}
                          onChange={() => alternar(a.id)}
                          aria-label={`Seleccionar ${a.title}`}
                          className="h-[18px] w-[18px] accent-accion align-middle"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <Miniatura src={a.portada} alt={a.title} size={44} />
                          <Link
                            href={`/admin/articulos/${a.id}`}
                            className="font-bold text-titular no-underline hover:underline"
                          >
                            {a.title}
                          </Link>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-cuerpo">{a.categoria}</td>
                      <td className="px-4 py-4 text-cuerpo">{a.seccion}</td>
                      <td className="px-4 py-4 text-cuerpo">{a.autor ?? '—'}</td>
                      <td className="px-4 py-4">
                        <span
                          className={cn(
                            'rounded-full px-3 py-1 text-[13px] font-bold',
                            a.status === 'published'
                              ? 'bg-accion/10 text-accion'
                              : 'bg-gris/15 text-gris',
                          )}
                        >
                          {a.status === 'published' ? 'Publicado' : 'Borrador'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-cuerpo">{a.publicado}</td>
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
                ¿Eliminar {seleccion.size} artículo{seleccion.size === 1 ? '' : 's'}?
              </h2>
              <p className="mt-2 text-[14px] text-cuerpo">
                Esta acción no se puede deshacer. Se eliminarán de forma permanente.
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
