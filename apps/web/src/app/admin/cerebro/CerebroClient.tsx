'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { eliminarEntradas } from '@/lib/brain/wikiAdmin';
import { cn } from '@/lib/cn';

export interface FilaEntrada {
  id: string;
  title: string;
  category_id: string;
  area: { name: string; color: string } | null;
  visibility: 'internal' | 'public';
  indexado: boolean;
  autor: string | null;
  actualizado: string;
}

export interface GrupoCategoria {
  id: string;
  slug: string;
  name: string;
  entradas: FilaEntrada[];
}

interface Props {
  grupos: GrupoCategoria[];
  categorias: { slug: string; name: string }[];
  areas: { id: number; name: string; color: string }[];
  q: string;
  categoriaSlug: string;
  areaId: string;
  total: number;
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

/** Estado de indexado en `brain_documents` (lo rellena la ingesta de rc-08). */
function IndexadoChip({ indexado }: { indexado: boolean }) {
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-0.5 text-[11.5px] font-bold',
        indexado ? 'bg-accion/10 text-accion' : 'bg-naranja/15 text-naranja',
      )}
    >
      {indexado ? 'En el cerebro' : 'Pendiente de indexar'}
    </span>
  );
}

export function CerebroClient({ grupos, categorias, areas, q, categoriaSlug, areaId, total }: Props) {
  const router = useRouter();

  const [montado, setMontado] = useState(false);
  const [busqueda, setBusqueda] = useState(q);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  useEffect(() => setMontado(true), []);

  const todasFilas = useMemo(() => grupos.flatMap((g) => g.entradas), [grupos]);

  // Al cambiar de filtro/búsqueda, la selección deja de ser válida.
  useEffect(() => setSeleccion(new Set()), [q, categoriaSlug, areaId]);

  function navegar(cambios: { q?: string; categoria?: string; area?: string }) {
    const params = new URLSearchParams();
    const nq = cambios.q !== undefined ? cambios.q : q;
    const ncat = cambios.categoria !== undefined ? cambios.categoria : categoriaSlug;
    const narea = cambios.area !== undefined ? cambios.area : areaId;
    if (nq) params.set('q', nq);
    if (ncat) params.set('categoria', ncat);
    if (narea) params.set('area', narea);
    const qs = params.toString();
    router.push(qs ? `/admin/cerebro?${qs}` : '/admin/cerebro');
  }

  // Búsqueda con debounce (400 ms).
  useEffect(() => {
    if (busqueda.trim() === q) return;
    const t = setTimeout(() => navegar({ q: busqueda.trim() }), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda]);

  function alternar(id: string) {
    setSeleccion((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function alternarGrupo(g: GrupoCategoria) {
    setSeleccion((prev) => {
      const n = new Set(prev);
      const todos = g.entradas.every((f) => n.has(f.id));
      if (todos) g.entradas.forEach((f) => n.delete(f.id));
      else g.entradas.forEach((f) => n.add(f.id));
      return n;
    });
  }

  function confirmarEliminar() {
    setError(null);
    const ids = Array.from(seleccion);
    iniciar(async () => {
      const r = await eliminarEntradas(ids);
      if (!r.ok) {
        setError(r.error ?? 'No se han podido eliminar.');
        setConfirmando(false);
        return;
      }
      setConfirmando(false);
      setSeleccion(new Set());
      router.refresh();
    });
  }

  const filasSeleccionadas = todasFilas.filter((f) => seleccion.has(f.id));

  return (
    <div>
      {/* Barra de herramientas: buscador + filtros de categoría/área */}
      <div className="mb-4 flex flex-col gap-3 min-[720px]:flex-row min-[720px]:flex-wrap min-[720px]:items-center">
        <div className="relative min-[720px]:w-[300px]">
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
          onChange={(e) => navegar({ categoria: e.target.value })}
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
          onChange={(e) => navegar({ area: e.target.value })}
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

        <span className="text-[13px] text-gris">
          {total} entrada{total === 1 ? '' : 's'}
        </span>
      </div>

      {error && (
        <p className="mb-3 rounded-boton border border-magenta/40 bg-magenta/5 px-4 py-2.5 text-[13.5px] font-semibold text-magenta">
          {error}
        </p>
      )}

      {/* Barra de acción de selección (persiste entre grupos) */}
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

      {total === 0 ? (
        <p className="rounded-tarjeta border border-linea bg-white p-6 text-cuerpo">
          {q || categoriaSlug || areaId
            ? 'No hay entradas que coincidan con el filtro.'
            : 'Todavía no hay entradas en el cerebro. Crea la primera.'}
        </p>
      ) : (
        <div className="space-y-6">
          {grupos.map((g) => {
            if (g.entradas.length === 0) {
              return (
                <section key={g.id}>
                  <h2 className="mb-2 text-[15px] font-bold text-titular">
                    {g.name} <span className="font-normal text-gris">· 0</span>
                  </h2>
                  <p className="rounded-tarjeta border border-dashed border-linea bg-white/60 p-4 text-[13.5px] text-gris">
                    Sin entradas en esta categoría todavía.
                  </p>
                </section>
              );
            }

            const todosMarcados = g.entradas.every((f) => seleccion.has(f.id));

            return (
              <section key={g.id}>
                <h2 className="mb-2 text-[15px] font-bold text-titular">
                  {g.name} <span className="font-normal text-gris">· {g.entradas.length}</span>
                </h2>

                {/* Móvil: tarjetas apiladas con checkbox */}
                <ul className="overflow-hidden rounded-tarjeta border border-linea bg-white min-[720px]:hidden">
                  {g.entradas.map((f, i) => {
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
                          <Link
                            href={`/admin/cerebro/${f.id}`}
                            className="block text-[15.5px] font-bold leading-snug text-titular no-underline hover:underline"
                          >
                            {f.title}
                          </Link>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <VisibilidadChip visibility={f.visibility} />
                            <IndexadoChip indexado={f.indexado} />
                            {f.area && <AreaChip area={f.area} />}
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
                  <table className="w-full min-w-[760px] border-collapse text-left text-[15px]">
                    <thead>
                      <tr className="border-b border-linea text-[13px] uppercase tracking-[.08em] text-gris">
                        <th className="w-[44px] px-4 py-4">
                          <input
                            type="checkbox"
                            checked={todosMarcados}
                            ref={(el) => {
                              if (el) el.indeterminate = !todosMarcados && g.entradas.some((f) => seleccion.has(f.id));
                            }}
                            onChange={() => alternarGrupo(g)}
                            aria-label={`Seleccionar todas en ${g.name}`}
                            className="h-[18px] w-[18px] accent-accion align-middle"
                          />
                        </th>
                        <th className="px-4 py-4 font-bold">Título</th>
                        <th className="px-4 py-4 font-bold">Área</th>
                        <th className="px-4 py-4 font-bold">Visibilidad</th>
                        <th className="px-4 py-4 font-bold">Cerebro</th>
                        <th className="px-4 py-4 font-bold">Autor</th>
                        <th className="px-4 py-4 font-bold">Actualizado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.entradas.map((f, i) => {
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
                              <Link
                                href={`/admin/cerebro/${f.id}`}
                                className="font-bold text-titular no-underline hover:underline"
                              >
                                {f.title}
                              </Link>
                            </td>
                            <td className="px-4 py-4">{f.area ? <AreaChip area={f.area} /> : <span className="text-gris">—</span>}</td>
                            <td className="px-4 py-4">
                              <VisibilidadChip visibility={f.visibility} />
                            </td>
                            <td className="px-4 py-4">
                              <IndexadoChip indexado={f.indexado} />
                            </td>
                            <td className="px-4 py-4 text-cuerpo">{f.autor ?? '—'}</td>
                            <td className="px-4 py-4 text-cuerpo">{f.actualizado}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
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
                {filasSeleccionadas.slice(0, 8).map((f) => (
                  <li key={f.id} className="truncate">
                    • {f.title}
                  </li>
                ))}
                {filasSeleccionadas.length > 8 && (
                  <li className="text-gris">…y {filasSeleccionadas.length - 8} más</li>
                )}
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
