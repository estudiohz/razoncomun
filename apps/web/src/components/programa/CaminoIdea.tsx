'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';

export interface PasoCamino {
  clave: string;
  icono: string;
  titulo: string;
  resumen: string;
  detalle: string;
  /** Propuestas que están ahora mismo en este paso (dato real). */
  ahora: number;
}

/** El recorrido de una idea hasta el programa, navegable paso a paso. */
export function CaminoIdea({ pasos }: { pasos: PasoCamino[] }) {
  const [i, setI] = useState(0);
  const paso = pasos[i];

  return (
    <div>
      <ol className="relative mx-auto grid max-w-[900px] grid-cols-5 gap-1">
        <span aria-hidden className="absolute left-[10%] right-[10%] top-[26px] h-[3px] rounded-full bg-linea" />
        <span
          aria-hidden
          className="absolute left-[10%] top-[26px] h-[3px] rounded-full bg-grad transition-[width] duration-500"
          style={{ width: `${(i / (pasos.length - 1)) * 80}%` }}
        />
        {pasos.map((p, n) => (
          <li key={p.clave} className="relative flex justify-center">
            <button
              type="button"
              onClick={() => setI(n)}
              aria-current={n === i ? 'step' : undefined}
              className="group flex flex-col items-center gap-2 text-center"
            >
              <span
                className={cn(
                  'relative z-10 flex h-[54px] w-[54px] items-center justify-center rounded-full border-2 text-[22px] transition-all duration-300',
                  n <= i ? 'border-transparent bg-grad shadow-boton' : 'border-linea bg-white group-hover:border-titular',
                  n === i && 'scale-110',
                )}
              >
                <span aria-hidden>{p.icono}</span>
              </span>
              <span
                className={cn(
                  'text-[11.5px] font-bold leading-tight min-[720px]:text-[13.5px]',
                  n === i ? 'text-titular' : 'text-cuerpo',
                )}
              >
                {p.titulo}
              </span>
            </button>
          </li>
        ))}
      </ol>

      <div className="mx-auto mt-8 max-w-[760px] rounded-tarjeta border border-linea bg-panel p-6 text-center shadow-tarjeta min-[720px]:p-8">
        <p className="text-[12px] font-bold uppercase tracking-[.14em] text-titular">
          Paso {i + 1} de {pasos.length}
        </p>
        <h3 className="mt-2 text-[22px] font-extrabold text-titular">{paso.resumen}</h3>
        <p className="mx-auto mt-3 max-w-[58ch] text-[15.5px] text-cuerpo">{paso.detalle}</p>
        {paso.ahora > 0 && (
          <p className="mt-4 inline-block rounded-full bg-fondo px-4 py-1.5 text-[13px] font-semibold text-cuerpo">
            Ahora mismo hay <strong className="text-titular">{paso.ahora}</strong>{' '}
            {paso.ahora === 1 ? 'propuesta' : 'propuestas'} en este paso
          </p>
        )}
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => setI(Math.max(0, i - 1))}
            disabled={i === 0}
            className="rounded-boton border border-linea bg-white px-5 py-2 text-[14px] font-bold text-cuerpo transition-colors hover:border-titular disabled:opacity-40"
          >
            ← Anterior
          </button>
          <button
            type="button"
            onClick={() => setI(Math.min(pasos.length - 1, i + 1))}
            disabled={i === pasos.length - 1}
            className="rounded-boton bg-accion px-5 py-2 text-[14px] font-bold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-40"
          >
            Siguiente →
          </button>
        </div>
      </div>
    </div>
  );
}
