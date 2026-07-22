'use client';

import Link from 'next/link';
import type { ProposalCategory } from '@/lib/participacion/types';

/** Sidebar de categorías (D-P14): nombre + punto de color + contador. `<select>` en móvil. */
export function SidebarCategorias({
  categorias,
  conteos,
  categoryId,
  hrefFiltro,
}: {
  categorias: ProposalCategory[];
  conteos: Record<string, number>;
  categoryId?: string;
  hrefFiltro: (next: { categoryId?: string }) => string;
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
            window.location.href = hrefFiltro({ categoryId: e.target.value || undefined });
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
              href={hrefFiltro({ categoryId: undefined })}
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
                href={hrefFiltro({ categoryId: c.id })}
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
