'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Barra "Ordenar por + buscar" del directorio de propuestas (pedida por
 * Sergio en sustitución de los chips Trending/Top/Nuevos): selector de orden
 * a la izquierda y buscador a la derecha, justo encima de la primera
 * propuesta. Todo URL-driven (?tab= y ?q=) para que el server component
 * filtre/ordene y los enlaces sean compartibles; la búsqueda navega con
 * debounce (mismo enfoque que el buscador de /admin/articulos). Los filtros
 * de estado y categoría viven fuera de esta barra y se preservan tal cual.
 */
export function BarraOrdenarBuscar({
  tab,
  q,
  status,
  categoryId,
}: {
  tab: 'trending' | 'top' | 'nuevos';
  q: string;
  status: string;
  categoryId: string;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState(q);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Si la URL cambia desde fuera (p. ej. clic en "Limpiar" o en un chip que
  // resetea), el input se realinea con lo que diga el servidor.
  useEffect(() => setTexto(q), [q]);

  function navegar(next: { tab?: string; q?: string }) {
    const params = new URLSearchParams();
    const t = next.tab !== undefined ? next.tab : tab;
    const busqueda = next.q !== undefined ? next.q : texto;
    if (status) params.set('status', status);
    if (categoryId) params.set('categoryId', categoryId);
    if (t && t !== 'trending') params.set('tab', t);
    if (busqueda.trim()) params.set('q', busqueda.trim());
    const qs = params.toString();
    router.push(qs ? `/propuestas?${qs}` : '/propuestas', { scroll: false });
  }

  function onBuscar(valor: string) {
    setTexto(valor);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => navegar({ q: valor }), 350);
  }

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-tarjeta border border-linea bg-panel px-4 py-3">
      <label className="flex items-center gap-2 text-[13px] font-bold text-gris">
        Ordenar por
        <select
          value={tab}
          onChange={(e) => navegar({ tab: e.target.value })}
          className="rounded-boton border border-linea bg-white px-3 py-2 text-[13.5px] font-semibold text-titular"
        >
          <option value="trending">🔥 Trending</option>
          <option value="top">🏆 Top</option>
          <option value="nuevos">🆕 Nuevos</option>
        </select>
      </label>

      <div className="relative min-w-[200px] flex-1 sm:max-w-[320px]">
        <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gris">
          🔍
        </span>
        <input
          type="search"
          value={texto}
          onChange={(e) => onBuscar(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
              navegar({ q: (e.target as HTMLInputElement).value });
            }
          }}
          placeholder="Buscar propuestas…"
          aria-label="Buscar propuestas"
          className="w-full rounded-boton border border-linea bg-white py-2 pl-9 pr-3 text-[13.5px] text-titular placeholder:text-gris"
        />
      </div>
    </div>
  );
}
