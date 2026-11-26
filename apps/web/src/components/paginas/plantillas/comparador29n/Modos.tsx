'use client';

import { useEffect, useState } from 'react';
import type { Apartado, Partido, PropuestaRc } from './tipos';
import { Comparador } from './Comparador';
import { Juego } from './Juego';
import { ProveedorVotos } from './votos';

type Modo = 'elegir' | 'comparar' | 'juego';
const CLAVE = 'rc-comparador29n-modo';

/**
 * Entrada al comparador: «ver con su partido» o «jugar a ciegas».
 * El comparador se pinta siempre en el HTML (SEO); la elección es una capa
 * encima que solo aparece en cliente. `?modo=juego` entra directo al juego
 * (enlace para compartir) y `?modo=comparar`, al comparador.
 */
export function Modos({ apartados, partidos, rc }: { apartados: Apartado[]; partidos: Partido[]; rc: Record<string, PropuestaRc[]> }) {
  const [modo, setModo] = useState<Modo>('comparar');

  useEffect(() => {
    const q = new URLSearchParams(location.search).get('modo');
    if (q === 'juego' || q === 'comparar') setModo(q);
    else if (sessionStorage.getItem(CLAVE) !== 'visto') setModo('elegir');
  }, []);

  const ir = (m: 'comparar' | 'juego') => {
    sessionStorage.setItem(CLAVE, 'visto');
    const url = new URL(location.href);
    url.searchParams.set('modo', m);
    history.replaceState(null, '', url);
    setModo(m);
    window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    if (modo !== 'elegir') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && ir('comparar');
    document.addEventListener('keydown', esc);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', esc);
    };
  }, [modo]);

  return (
    <ProveedorVotos>
      {modo === 'juego' ? (
        <Juego apartados={apartados} partidos={partidos} rc={rc} onSalir={() => ir('comparar')} />
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-[14px] border border-linea bg-white px-5 py-3.5">
            <span className="text-[14px] font-bold text-titular">¿Y si no supieras de quién es cada propuesta?</span>
            <button type="button" onClick={() => ir('juego')} className="ml-auto min-h-[44px] rounded-boton px-5 text-[14px] font-bold text-white" style={{ background: 'linear-gradient(120deg,#6A1FB8,#8B30D9 45%,#C3369E)' }}>
              Jugar a ciegas
            </button>
          </div>
          <Comparador apartados={apartados} partidos={partidos} rc={rc} />
        </>
      )}

      {modo === 'elegir' ? (
        <div role="dialog" aria-modal="true" aria-labelledby="titulo-modo" className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto p-4" style={{ background: 'linear-gradient(150deg,rgba(27,61,156,.92),rgba(139,48,217,.9) 40%,rgba(195,54,158,.88) 65%,rgba(22,184,160,.9))' }}>
          <div className="w-full max-w-[760px] rounded-[22px] bg-white p-6 shadow-2xl min-[720px]:p-9">
            <p className="text-[12px] font-bold uppercase tracking-[.14em] text-gris">Elecciones generales · 29 de noviembre</p>
            <h2 id="titulo-modo" className="mt-2 text-[clamp(26px,4vw,38px)] font-extrabold leading-tight text-titular">¿Cómo quieres ver las propuestas?</h2>
            <div className="mt-6 grid gap-4 min-[640px]:grid-cols-2">
              <button type="button" onClick={() => ir('comparar')} className="flex flex-col items-start gap-2 rounded-[18px] border-2 border-linea bg-white p-5 text-left transition-colors hover:border-titular">
                <span className="text-[13px] font-extrabold uppercase tracking-[.1em] text-gris">Con su partido</span>
                <span className="text-[20px] font-extrabold leading-snug text-titular">Ver el comparador</span>
                <span className="text-[14px] leading-snug text-cuerpo">Cada propuesta con su fuerza, su cita del programa y nuestro análisis.</span>
              </button>
              <button type="button" onClick={() => ir('juego')} className="flex flex-col items-start gap-2 rounded-[18px] p-5 text-left text-white" style={{ background: 'linear-gradient(120deg,#6A1FB8,#8B30D9 45%,#C3369E)' }}>
                <span className="text-[13px] font-extrabold uppercase tracking-[.1em] text-white/85">A ciegas</span>
                <span className="text-[20px] font-extrabold leading-snug">Jugar sin saber de quién es</span>
                <span className="text-[14px] leading-snug text-white/90">Vota las propuestas mezcladas y al final descubre con quién coincides de verdad.</span>
              </button>
            </div>
            <p className="mt-5 text-[12.5px] text-gris">No necesitas registrarte. Tus votos solo los ves tú: no se guardan ni se envían.</p>
          </div>
        </div>
      ) : null}
    </ProveedorVotos>
  );
}
