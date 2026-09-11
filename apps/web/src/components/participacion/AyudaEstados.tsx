'use client';

import { useEffect, useRef, useState } from 'react';
import { ETIQUETA_ESTADO, type EstadoPropuesta } from '@/lib/participacion/types';

/** Mismo contenido que la ayuda del panel de moderación, en tono ciudadano
 * (D-P3: el ciclo es seed→deliberation→stress_test→voting→adopted|discarded). */
const PASOS: { estado: EstadoPropuesta; texto: string }[] = [
  { estado: 'seed', texto: 'Recién creada. Cualquiera puede apoyarla, comentarla o posicionarse en contra.' },
  { estado: 'deliberation', texto: 'Se abre la deliberación estructurada: afirmaciones a favor, en contra o de paso, para encontrar dónde hay consenso real antes de seguir.' },
  { estado: 'stress_test', texto: 'Revisión técnica y de viabilidad — si hace falta, con un informe adjunto.' },
  { estado: 'voting', texto: 'Votación abierta al censo: sí, no o abstención, hasta la fecha límite.' },
  { estado: 'planned', texto: 'Aprobada y programada para incorporarse al programa.' },
  { estado: 'adopted', texto: 'Ya forma parte del programa vigente.' },
  { estado: 'discarded', texto: 'No siguió adelante — la decisión y su porqué quedan igualmente públicos.' },
];

/**
 * Botón "?" con la explicación de las fases de una propuesta, en tooltip/popover.
 *
 * Petición de Sergio (11/09/2026): la parte pública no explicaba en ningún
 * sitio qué diferencia "Propuesta" de "En deliberación" — un ciudadano no
 * tiene por qué saberlo de memoria solo porque el equipo sí.
 */
export function AyudaEstados({ className }: { className?: string }) {
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    function alClicFuera(e: MouseEvent) {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) setAbierto(false);
    }
    function alEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setAbierto(false);
    }
    document.addEventListener('mousedown', alClicFuera);
    document.addEventListener('keydown', alEscape);
    return () => {
      document.removeEventListener('mousedown', alClicFuera);
      document.removeEventListener('keydown', alEscape);
    };
  }, [abierto]);

  return (
    <div ref={contenedor} className={`relative inline-block ${className ?? ''}`}>
      <button
        type="button"
        aria-label="Qué significa cada fase de una propuesta"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
        className="grid h-5 w-5 place-items-center rounded-full border border-linea bg-white text-[11px] font-extrabold text-gris hover:border-titular hover:text-titular"
      >
        ?
      </button>
      {abierto && (
        <div className="absolute left-1/2 top-full z-20 mt-2 w-[300px] -translate-x-1/2 rounded-tarjeta border border-linea bg-white p-4 text-left shadow-caja min-[480px]:w-[340px]">
          <p className="mb-2.5 text-[12px] font-extrabold uppercase tracking-[.06em] text-gris">
            Las fases de una propuesta
          </p>
          <dl className="space-y-2">
            {PASOS.map((p) => (
              <div key={p.estado}>
                <dt className="text-[13px] font-bold text-titular">{ETIQUETA_ESTADO[p.estado]}</dt>
                <dd className="text-[12.5px] leading-snug text-cuerpo">{p.texto}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
