'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ItemCarrito } from '@/lib/tienda/tipos';

/**
 * Carrito 100 % en el navegador (D-T2): `localStorage`, sin tabla ni sesión.
 * Solo guarda `{variantId, cantidad}` — NUNCA precios: el importe se
 * recalcula siempre en el servidor contra Printful (D-T3), así que un
 * localStorage manipulado no puede abaratar una compra.
 */
const CLAVE = 'rc_carrito_v1';
const LIMITE_POR_LINEA = 20;

interface Contexto {
  items: ItemCarrito[];
  totalArticulos: number;
  /** true hasta que se ha leído localStorage (evita parpadeo del contador en SSR). */
  cargado: boolean;
  abierto: boolean;
  abrir: () => void;
  cerrar: () => void;
  anadir: (variantId: number, cantidad?: number) => void;
  cambiarCantidad: (variantId: number, cantidad: number) => void;
  quitar: (variantId: number) => void;
  vaciar: () => void;
}

const CarritoCtx = createContext<Contexto | null>(null);

function leer(): ItemCarrito[] {
  if (typeof window === 'undefined') return [];
  try {
    const crudo = JSON.parse(window.localStorage.getItem(CLAVE) ?? '[]');
    if (!Array.isArray(crudo)) return [];
    // Saneado defensivo: lo que hay en localStorage es del usuario, puede
    // estar corrupto o editado a mano.
    return crudo
      .map((i) => ({ variantId: Number(i?.variantId), cantidad: Number(i?.cantidad) }))
      .filter((i) => Number.isFinite(i.variantId) && i.variantId > 0 && i.cantidad > 0)
      .map((i) => ({ ...i, cantidad: Math.min(Math.floor(i.cantidad), LIMITE_POR_LINEA) }));
  } catch {
    return [];
  }
}

export function CarritoProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ItemCarrito[]>([]);
  const [cargado, setCargado] = useState(false);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    setItems(leer());
    setCargado(true);
  }, []);

  useEffect(() => {
    if (!cargado) return;
    try {
      window.localStorage.setItem(CLAVE, JSON.stringify(items));
    } catch {
      /* modo privado o cuota llena: el carrito sigue funcionando en memoria */
    }
  }, [items, cargado]);

  // Si el usuario tiene la tienda abierta en dos pestañas, que no se pisen.
  useEffect(() => {
    function alCambiar(e: StorageEvent) {
      if (e.key === CLAVE) setItems(leer());
    }
    window.addEventListener('storage', alCambiar);
    return () => window.removeEventListener('storage', alCambiar);
  }, []);

  const anadir = useCallback((variantId: number, cantidad = 1) => {
    setItems((previos) => {
      const existente = previos.find((i) => i.variantId === variantId);
      if (!existente) return [...previos, { variantId, cantidad }];
      return previos.map((i) =>
        i.variantId === variantId
          ? { ...i, cantidad: Math.min(i.cantidad + cantidad, LIMITE_POR_LINEA) }
          : i,
      );
    });
    setAbierto(true);
  }, []);

  const cambiarCantidad = useCallback((variantId: number, cantidad: number) => {
    setItems((previos) =>
      cantidad <= 0
        ? previos.filter((i) => i.variantId !== variantId)
        : previos.map((i) =>
            i.variantId === variantId ? { ...i, cantidad: Math.min(cantidad, LIMITE_POR_LINEA) } : i,
          ),
    );
  }, []);

  const valor = useMemo<Contexto>(
    () => ({
      items,
      totalArticulos: items.reduce((s, i) => s + i.cantidad, 0),
      cargado,
      abierto,
      abrir: () => setAbierto(true),
      cerrar: () => setAbierto(false),
      anadir,
      cambiarCantidad,
      quitar: (variantId) => setItems((p) => p.filter((i) => i.variantId !== variantId)),
      vaciar: () => setItems([]),
    }),
    [items, cargado, abierto, anadir, cambiarCantidad],
  );

  return <CarritoCtx.Provider value={valor}>{children}</CarritoCtx.Provider>;
}

export function useCarrito(): Contexto {
  const ctx = useContext(CarritoCtx);
  if (!ctx) throw new Error('useCarrito debe usarse dentro de <CarritoProvider>');
  return ctx;
}
