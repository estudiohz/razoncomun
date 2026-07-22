'use client';

import Link from 'next/link';
import type { ProposalCategory } from '@/lib/participacion/types';

/** Sidebar de categorías (D-P14): nombre + punto de color + contador. `<select>` en móvil. */
export function SidebarCategorias({
  categorias,
  conteos,
  categoryId,
  hrefTodas,
  hrefPorCategoria,
}: {
  categorias: ProposalCategory[];
  conteos: Record<string, number>;
  categoryId?: string;
  // Hrefs precomputados en el servidor: no se pueden pasar funciones a un
  // Client Component (regla de serialización RSC).
  hrefTodas: string;
  hrefPorCategoria: Record<string, string>;
}) {
  return (
    <>
      {/* Móvil: select */}
      <div className="min-[860px]:hidden">
        <label htmlFor="categoria-movil" className="sr-only">
          Categoría
        </label>
        <select
          id="categoria-movil"
          defaultValue={categoryId ?? ''}
          onChange={(e) => {
            window.location.href = e.target.value ? hrefPorCategoria[e.target.value] : hrefTodas;
          }}
          className="w-full rounded-boton border border-linea bg-white px-4 py-2.5 text-[14px]"
        >
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre} ({conteos[c.id] ?? 0})
            </option>
          ))}
        </select>
      </div>

      {/* Escritorio: lista lateral */}
      <nav aria-label="Categorías" className="hidden min-[860px]:block">
        <ul className="space-y-1">
          <li>
            <Link
              href={hrefTodas}
              className={
                'flex items-center justify-between rounded-boton px-3 py-2 text-[14px] font-semibold no-underline ' +
                (!categoryId ? 'bg-accion/10 text-titular' : 'text-cuerpo hover:bg-fondo')
              }
            >
              Todas las categorías
            </Link>
          </li>
          {categorias.map((c) => (
            <li key={c.id}>
              <Link
                href={hrefPorCategoria[c.id]}
                className={
                  'flex items-center justify-between rounded-boton px-3 py-2 text-[14px] font-semibold no-underline ' +
                  (categoryId === c.id ? 'bg-accion/10 text-titular' : 'text-cuerpo hover:bg-fondo')
                }
              >
                <span className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: c.color }}
                  />
                  {c.nombre}
                </span>
                <span className="text-[12px] text-gris">{conteos[c.id] ?? 0}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
