'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AlternativaRc } from './alternativasRc';

interface Propuesta { texto: string; url?: string | null }
interface Partido { id: string; nombre: string; color: string }
interface Tema {
  id: string;
  titulo: string;
  dato?: { texto: string; fuente?: string; url?: string } | null;
  propuestas: Record<string, Propuesta[] | null>;
}
export interface DatosComparador { actualizado: string; partidos: Partido[]; temas: Tema[] }

const RC = { id: 'rc', nombre: 'Razón Común', color: '#16B8A0' };

/**
 * Comparador interactivo. La afinidad se calcula SOLO en el navegador (estado
 * React, ni localStorage ni servidor): una opinión política es dato de
 * categoría especial (RGPD Art. 9) y aquí no se recoge.
 */
export function Comparador({ datos, alternativas }: { datos: DatosComparador; alternativas: Record<string, AlternativaRc> }) {
  const [temaId, setTemaId] = useState(datos.temas[0]?.id);
  const [visibles, setVisibles] = useState<string[]>(datos.partidos.map((p) => p.id));
  const [eleccion, setEleccion] = useState<Record<string, string>>({});
  // Orden de columnas barajado una vez por visita: nadie sale siempre el primero.
  // (en un efecto, no en el render, para no romper la hidratación).
  const [orden, setOrden] = useState(datos.partidos);
  useEffect(() => {
    setOrden([...datos.partidos].sort(() => Math.random() - 0.5));
  }, [datos.partidos]);

  const tema = datos.temas.find((t) => t.id === temaId) ?? datos.temas[0];
  const columnas = orden.filter((p) => visibles.includes(p.id));
  const rc = alternativas[tema?.id ?? ''];

  const recuento = useMemo(() => {
    const r: Record<string, number> = {};
    for (const v of Object.values(eleccion)) r[v] = (r[v] ?? 0) + 1;
    return r;
  }, [eleccion]);
  const respondidos = Object.keys(eleccion).length;
  const todos = [...datos.partidos, RC];

  if (!tema) return null;

  function elegir(id: string) {
    setEleccion((e) => ({ ...e, [tema.id]: e[tema.id] === id ? '' : id }));
  }
  const elegido = eleccion[tema.id];

  return (
    <div>
      {/* Temas */}
      <div className="-mx-1 flex flex-wrap gap-2" role="tablist" aria-label="Temas">
        {datos.temas.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === tema.id}
            onClick={() => setTemaId(t.id)}
            className={`rounded-full border px-4 py-2 text-[13.5px] font-bold transition ${
              t.id === tema.id ? 'border-titular bg-titular text-white' : 'border-linea bg-white text-cuerpo hover:border-titular'
            }`}
          >
            {t.titulo}
            {eleccion[t.id] ? ' ✓' : ''}
          </button>
        ))}
      </div>

      {/* Filtro de partidos */}
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-gris">
        <span className="font-bold uppercase tracking-wide">Comparar:</span>
        {datos.partidos.map((p) => (
          <label key={p.id} className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={visibles.includes(p.id)}
              onChange={() =>
                setVisibles((v) => (v.includes(p.id) ? v.filter((x) => x !== p.id) : [...v, p.id]))
              }
              style={{ accentColor: p.color }}
            />
            {p.nombre}
          </label>
        ))}
      </div>

      {/* Dato real del tema */}
      {tema.dato ? (
        <div className="mt-6 rounded-tarjeta border border-linea bg-white px-5 py-4">
          <p className="text-[11px] font-bold uppercase tracking-[.1em] text-gris">El dato</p>
          <p className="mt-1 text-[16px] font-semibold text-titular">{tema.dato.texto}</p>
          {tema.dato.fuente ? (
            <p className="mt-1 text-[12px] text-gris">
              Fuente:{' '}
              {tema.dato.url ? (
                <a href={tema.dato.url} target="_blank" rel="noopener nofollow" className="underline">
                  {tema.dato.fuente}
                </a>
              ) : (
                tema.dato.fuente
              )}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Columnas */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {columnas.map((p) => {
          const props = tema.propuestas[p.id];
          return (
            <Tarjeta key={p.id} nombre={p.nombre} color={p.color} activa={elegido === p.id} onElegir={() => elegir(p.id)}>
              {props && props.length ? (
                <ul className="space-y-3">
                  {props.map((x, i) => (
                    <li key={i} className="text-[14.5px] leading-snug text-cuerpo">
                      {x.texto}{' '}
                      {x.url ? (
                        <a href={x.url} target="_blank" rel="noopener nofollow" className="text-[12px] text-gris underline">
                          fuente
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[14px] italic text-gris">No hemos encontrado propuesta concreta sobre este tema en su programa.</p>
              )}
            </Tarjeta>
          );
        })}
      </div>

      {/* Alternativa RC */}
      {rc ? (
        <div className="mt-6">
          <Tarjeta nombre="La alternativa de Razón Común" color={RC.color} destacada activa={elegido === RC.id} onElegir={() => elegir(RC.id)}>
            <ul className="space-y-3">
              {rc.puntos.map((pt) => (
                <li key={pt.n} className="text-[14.5px] leading-snug text-cuerpo">
                  <span className="font-bold text-titular">Punto {pt.n} · {pt.titulo}.</span> {pt.texto}
                </li>
              ))}
            </ul>
            <a href="/manifiesto" className="mt-4 inline-block text-[13px] font-bold text-accion underline">
              Ver los 30 puntos del manifiesto →
            </a>
          </Tarjeta>
        </div>
      ) : null}

      {/* Afinidad */}
      <div className="mt-10 rounded-tarjeta border border-linea bg-white p-6">
        <h2 className="text-[20px] font-extrabold text-titular">Tu afinidad</h2>
        <p className="mt-1 text-[13.5px] text-gris">
          Marca en cada tema la propuesta con la que más estás de acuerdo. Llevas {respondidos} de {datos.temas.length} temas.
        </p>
        {respondidos > 0 ? (
          <div className="mt-5 space-y-2.5">
            {todos
              .map((p) => ({ ...p, n: recuento[p.id] ?? 0 }))
              .sort((a, b) => b.n - a.n)
              .map((p) => (
                <div key={p.id} className="flex items-center gap-3 text-[13.5px]">
                  <span className="w-[120px] shrink-0 font-semibold text-titular">{p.nombre}</span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-linea/60">
                    <div className="h-full rounded-full" style={{ width: `${(p.n / respondidos) * 100}%`, background: p.color }} />
                  </div>
                  <span className="w-[34px] text-right tabular-nums text-gris">{p.n}</span>
                </div>
              ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Tarjeta({
  nombre, color, activa, destacada, onElegir, children,
}: {
  nombre: string; color: string; activa: boolean; destacada?: boolean; onElegir: () => void; children: React.ReactNode;
}) {
  return (
    <div
      className={`flex flex-col rounded-tarjeta border bg-white p-5 ${destacada ? 'border-2' : ''}`}
      style={{ borderColor: activa || destacada ? color : undefined, borderTopWidth: 4, borderTopColor: color }}
    >
      <h3 className="mb-3 text-[16px] font-extrabold text-titular">{nombre}</h3>
      <div className="flex-1">{children}</div>
      <button
        onClick={onElegir}
        aria-pressed={activa}
        className="mt-4 self-start rounded-boton border px-3.5 py-1.5 text-[12.5px] font-bold"
        style={activa ? { background: color, borderColor: color, color: '#fff' } : { borderColor: color, color }}
      >
        {activa ? '✓ Me convence' : 'Me convence esta'}
      </button>
    </div>
  );
}
