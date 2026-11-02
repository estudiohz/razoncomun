'use client';

import { EVENTO_AVISO, type TipoAviso } from './comun';

/** Lanza un aviso desde un Client Component (lo pinta `<Avisos />`). */
export function avisar(texto: string, tipo: TipoAviso = 'exito') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(EVENTO_AVISO, { detail: { id: `${Date.now()}-${Math.random()}`, texto, tipo } }),
  );
}
