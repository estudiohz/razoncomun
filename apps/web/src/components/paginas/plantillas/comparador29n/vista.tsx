'use client';

import { useEffect, useState } from 'react';

/**
 * Diseño del comparador, alternable como un tema claro/oscuro:
 * 'lateral' (menú a la izquierda, 2×2) o 'columnas' (apartados en tarjetas,
 * un partido por columna). Preferencia de interfaz, no un dato personal: se
 * recuerda en localStorage y se sincroniza entre botón y comparador con un evento.
 */
export type Vista = 'lateral' | 'columnas';
const CLAVE = 'rc-comparador29n-vista';
const EVENTO = 'rc-vista-29n';

export function useVista(): [Vista, (v: Vista) => void] {
  const [vista, setVistaLocal] = useState<Vista>('lateral');
  useEffect(() => {
    const leer = () => setVistaLocal(localStorage.getItem(CLAVE) === 'columnas' ? 'columnas' : 'lateral');
    leer();
    window.addEventListener(EVENTO, leer);
    return () => window.removeEventListener(EVENTO, leer);
  }, []);
  const setVista = (v: Vista) => {
    localStorage.setItem(CLAVE, v);
    window.dispatchEvent(new Event(EVENTO));
  };
  return [vista, setVista];
}

/** Interruptor de diseño, junto al título. Solo en escritorio: en móvil no hay sitio para 4 columnas. */
export function BotonVista() {
  const [vista, setVista] = useVista();
  const opciones: { v: Vista; etiqueta: string; icono: string[] }[] = [
    { v: 'lateral', etiqueta: 'Por partido', icono: ['M3 4h5v16H3z', 'M11 4h10v7H11z', 'M11 13h10v7H11z'] },
    { v: 'columnas', etiqueta: 'En columnas', icono: ['M3 4h4v16H3z', 'M8.5 4h4v16h-4z', 'M14 4h3v16h-3z', 'M18.5 4H21v16h-2.5z'] },
  ];
  return (
    <div role="group" aria-label="Cambiar diseño" className="hidden shrink-0 rounded-full border border-linea bg-white p-1 shadow-[0_1px_2px_rgba(27,61,156,.08)] min-[1100px]:inline-flex">
      {opciones.map((o) => {
        const on = vista === o.v;
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => setVista(o.v)}
            aria-pressed={on}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-full px-4 text-[13px] font-bold transition-colors"
            style={on ? { background: '#1B3D9C', color: '#fff' } : { color: '#1B3D9C' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
              {o.icono.map((d) => <path key={d} d={d} />)}
            </svg>
            {o.etiqueta}
          </button>
        );
      })}
    </div>
  );
}
