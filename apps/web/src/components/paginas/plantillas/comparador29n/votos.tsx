'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * Votos por PROPUESTA (flecha arriba = +1, abajo = −1), compartidos entre el
 * comparador y el juego a ciegas. Solo en memoria del navegador: una opinión
 * política es dato de categoría especial (RGPD Art. 9) y no se guarda ni se envía.
 * Clave: `${apartado}|${fuerza}|${índice}`.
 */
type Votos = Record<string, 1 | -1>;
const Ctx = createContext<{ votos: Votos; votar: (clave: string, v: 1 | -1) => void; reiniciar: () => void } | null>(null);

export function ProveedorVotos({ children }: { children: ReactNode }) {
  const [votos, setVotos] = useState<Votos>({});
  const valor = useMemo(
    () => ({
      votos,
      votar: (clave: string, v: 1 | -1) =>
        setVotos((prev) => {
          const sig = { ...prev };
          if (sig[clave] === v) delete sig[clave];
          else sig[clave] = v;
          return sig;
        }),
      reiniciar: () => setVotos({}),
    }),
    [votos],
  );
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useVotos() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useVotos fuera de ProveedorVotos');
  return c;
}

export const claveVoto = (apartado: string, fuerza: string, i: number) => `${apartado}|${fuerza}|${i}`;

/** Flecha arriba / abajo de una propuesta. */
export function Flechas({ clave, compacto }: { clave: string; compacto?: boolean }) {
  const { votos, votar } = useVotos();
  const v = votos[clave];
  const base = `inline-flex items-center justify-center gap-1.5 rounded-[10px] border-[1.5px] font-bold transition-colors ${compacto ? 'h-[40px] w-[44px]' : 'min-h-[40px] px-3 text-[12.5px]'}`;
  return (
    <div className="flex items-center gap-2" role="group" aria-label="Tu valoración de esta propuesta">
      <button
        type="button"
        onClick={() => votar(clave, 1)}
        aria-pressed={v === 1}
        aria-label="Me gusta esta propuesta"
        className={base}
        style={v === 1 ? { background: '#1E9E5A', borderColor: '#1E9E5A', color: '#fff' } : { borderColor: '#CFD3DD', color: '#1B3D9C', background: '#fff' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5" /><path d="M5 12l7-7 7 7" /></svg>
        {compacto ? null : 'Me gusta'}
      </button>
      <button
        type="button"
        onClick={() => votar(clave, -1)}
        aria-pressed={v === -1}
        aria-label="No me gusta esta propuesta"
        className={base}
        style={v === -1 ? { background: '#D0342C', borderColor: '#D0342C', color: '#fff' } : { borderColor: '#CFD3DD', color: '#1B3D9C', background: '#fff' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14" /><path d="M19 12l-7 7-7-7" /></svg>
        {compacto ? null : 'No me gusta'}
      </button>
    </div>
  );
}

export interface FuerzaAfinidad { id: string; nombre: string; color: string }

/**
 * Afinidad = (me gusta − no me gusta) / propuestas votadas de esa fuerza.
 * Dividir por lo votado evita que gane quien tiene más propuestas.
 */
export function calcularAfinidad(votos: Votos, fuerzas: FuerzaAfinidad[]) {
  return fuerzas
    .map((f) => {
      const suyos = Object.entries(votos).filter(([k]) => k.split('|')[1] === f.id).map(([, v]) => v);
      const arriba = suyos.filter((v) => v === 1).length;
      const abajo = suyos.length - arriba;
      return { ...f, arriba, abajo, votadas: suyos.length, puntuacion: suyos.length ? (arriba - abajo) / suyos.length : 0 };
    })
    .sort((a, b) => b.puntuacion - a.puntuacion || b.votadas - a.votadas);
}

export function BloqueAfinidad({ fuerzas, titulo = 'Tu afinidad', texto }: { fuerzas: FuerzaAfinidad[]; titulo?: string; texto?: string }) {
  const { votos, reiniciar } = useVotos();
  const filas = calcularAfinidad(votos, fuerzas);
  const total = Object.keys(votos).length;
  return (
    <section className="rounded-[18px] border border-linea bg-white p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[20px] font-extrabold text-titular">{titulo}</h2>
        {total ? (
          <button type="button" onClick={reiniciar} className="text-[12.5px] font-bold text-gris underline">Empezar de cero</button>
        ) : null}
      </div>
      <p className="mt-1 text-[13.5px] text-gris">
        {texto ?? 'Vota cada propuesta con la flecha arriba o abajo, de cualquier fuerza. Aquí verás con quién coincides más.'} Has votado {total}. Solo lo ves tú: no se guarda.
      </p>
      {total ? (
        <div className="mt-5 space-y-3">
          {filas.map((f) => {
            const pct = Math.round(((f.puntuacion + 1) / 2) * 100);
            return (
              <div key={f.id} className="flex items-center gap-3 text-[13.5px]">
                <span className="w-[110px] shrink-0 font-semibold text-titular">{f.nombre}</span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-linea/60" role="img" aria-label={`${f.nombre}: ${f.votadas ? pct + ' % de afinidad' : 'sin votos'}`}>
                  <div className="h-full rounded-full" style={{ width: f.votadas ? `${pct}%` : 0, background: f.color }} />
                </div>
                <span className="w-[88px] text-right text-[12px] tabular-nums text-gris">
                  {f.votadas ? `▲${f.arriba} ▼${f.abajo}` : 'sin votos'}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
