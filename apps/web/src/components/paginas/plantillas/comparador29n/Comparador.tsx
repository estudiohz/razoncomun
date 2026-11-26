'use client';

import { useEffect, useMemo, useState } from 'react';
import { COLOR_APARTADO, type Apartado, type Partido, type PropuestaRc, type PropuestaVerificada, type Seguimiento, type Veredicto, type Fuente, type Viabilidad, type Ficha } from './tipos';

const VEREDICTO: Record<Veredicto, { color: string; etiqueta: string }> = {
  verde: { color: '#1E9E5A', etiqueta: 'Posible' },
  naranja: { color: '#E8792F', etiqueta: 'Con matices' },
  rojo: { color: '#D0342C', etiqueta: 'Inviable tal cual' },
  gris: { color: '#8A8F9C', etiqueta: 'No evaluable' },
};
const RC_COLOR = '#16B8A0';
const GRADIENTE = 'linear-gradient(90deg,#1B3D9C,#8B30D9 25%,#C3369E 45%,#E8792F 65%,#16B8A0 85%,#2BC7E8)';

function Icono({ d, size = 16 }: { d: string[]; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d.map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}

function enlacePdf(url: string | null | undefined, pagina: number | null) {
  if (!url) return null;
  return pagina ? `${url}#page=${pagina}` : url;
}

/**
 * Comparador por apartados (diseño A). «Me convence» = voto privado del
 * visitante: estado React, ni localStorage ni servidor (RGPD Art. 9).
 */
export function Comparador({ apartados, partidos, rc }: { apartados: Apartado[]; partidos: Partido[]; rc: Record<string, PropuestaRc[]> }) {
  const [sel, setSel] = useState(0);
  const [voto, setVoto] = useState<Record<string, string>>({});
  // Cara a cara: qué partidos se ven (mínimo uno).
  const [visibles, setVisibles] = useState<string[]>(partidos.map((p) => p.id));
  const alternar = (id: string) =>
    setVisibles((v) => (v.includes(id) ? (v.length > 1 ? v.filter((x) => x !== id) : v) : [...v, id]));
  // Orden barajado una vez por visita, tras montar (no rompe la hidratación).
  const [orden, setOrden] = useState(partidos);
  useEffect(() => setOrden([...partidos].sort(() => Math.random() - 0.5)), [partidos]);

  const ap = apartados[sel];
  const color = COLOR_APARTADO[ap?.id ?? ''] ?? '#1B3D9C';
  const recuento = useMemo(() => {
    const r: Record<string, number> = {};
    for (const v of Object.values(voto)) if (v) r[v] = (r[v] ?? 0) + 1;
    return r;
  }, [voto]);
  const respondidos = Object.values(voto).filter(Boolean).length;
  if (!ap) return null;

  const elegir = (id: string) => setVoto((v) => ({ ...v, [ap.id]: v[ap.id] === id ? '' : id }));

  return (
    <div className="flex flex-wrap items-start gap-8">
      <div className="w-full min-[900px]:hidden">
        <label htmlFor="apartado-29n" className="mb-1.5 block text-[12px] font-bold uppercase tracking-[.1em] text-gris">Apartado</label>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full" style={{ background: color }} />
          <select
            id="apartado-29n"
            value={sel}
            onChange={(e) => setSel(Number(e.target.value))}
            className="h-[52px] w-full appearance-none rounded-[14px] border-2 bg-white pl-10 pr-10 text-[16px] font-bold text-titular"
            style={{ borderColor: color }}
          >
            {apartados.map((a, i) => (
              <option key={a.id} value={i}>
                {String(i + 1).padStart(2, '0')} · {a.titulo}{voto[a.id] ? ' ✓' : ''}
              </option>
            ))}
          </select>
          <span aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-titular">▾</span>
        </div>
      </div>

      <nav aria-label="Apartados" className="hidden w-[250px] flex-col gap-1 min-[900px]:sticky min-[900px]:top-24 min-[900px]:flex">
        {apartados.map((a, i) => {
          const c = COLOR_APARTADO[a.id] ?? '#1B3D9C';
          const activo = i === sel;
          return (
            <button
              key={a.id}
              onClick={() => setSel(i)}
              aria-pressed={activo}
              className="flex min-h-[44px] items-center gap-3 rounded-[10px] px-3.5 text-left text-[14.5px] text-titular"
              style={{ fontWeight: activo ? 800 : 600, background: activo ? `${c}1F` : 'transparent' }}
            >
              <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: c }} />
              <span className="flex-1">{a.titulo}</span>
              <span className="text-[11px] font-semibold text-gris">{voto[a.id] ? '✓' : String(i + 1).padStart(2, '0')}</span>
            </button>
          );
        })}
        <Leyenda />
      </nav>

      <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
        {/* Móvil: franja fija con el degradado corporativo detrás del header… */}
        <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-40 h-[92px] min-[900px]:hidden" style={{ background: GRADIENTE }} />
        {/* …que continúa sin corte en la barra de pastillas (degradado horizontal: casa a cualquier altura). */}
        <div className="sticky top-[92px] z-40 -mx-4 px-4 py-2.5 shadow-[0_6px_14px_rgba(27,61,156,.12)] min-[900px]:hidden" style={{ background: GRADIENTE }} role="navigation" aria-label="Ir a un partido">
          <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
            {[...partidos.map((p) => ({ id: p.id, sigla: p.sigla, color: p.color })), { id: 'rc', sigla: 'RC', color: RC_COLOR }].map((p) => (
              <a
                key={p.id}
                href={`#partido-${p.id}`}
                className="inline-flex min-h-[40px] flex-none items-center gap-1.5 rounded-full border-2 bg-white px-3.5 text-[13px] font-extrabold text-titular no-underline"
                style={{ borderColor: p.color }}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                {p.sigla}
              </a>
            ))}
          </div>
        </div>
        <div className="rounded-[18px] px-7 py-6 text-titular" style={{ background: `${color}24`, borderTop: `6px solid ${color}` }}>
          <p className="text-[12px] font-bold uppercase tracking-[.12em] opacity-85">Apartado {String(sel + 1).padStart(2, '0')}</p>
          <h2 className="mt-1 text-[clamp(26px,3.4vw,34px)] font-extrabold">{ap.titulo}</h2>
        </div>

        {ap.dato ? (
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-[14px] border border-linea bg-white px-5 py-4">
            <span className="text-[11px] font-bold uppercase tracking-[.12em] text-gris">El dato</span>
            <span className="text-[16px] font-semibold text-titular">{ap.dato.texto}</span>
            <a href={ap.dato.url} target="_blank" rel="noopener nofollow" className="ml-auto text-[12px] underline">
              Fuente: {ap.dato.fuente}
            </a>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Partidos que comparas">
          <span className="text-[11px] font-bold uppercase tracking-[.12em] text-gris">Comparar</span>
          {partidos.map((p) => {
            const on = visibles.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => alternar(p.id)}
                aria-pressed={on}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border-[1.5px] px-3 text-[12.5px] font-bold"
                style={on ? { borderColor: p.color, background: `${p.color}14`, color: '#1B3D9C' } : { borderColor: '#E4E6EE', color: '#6B6B6B' }}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: on ? p.color : '#C9CCD6' }} />
                {p.sigla}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2">
          {orden.filter((p) => visibles.includes(p.id)).map((p) => (
            <TarjetaPartido
              key={p.id}
              partido={p}
              propuestas={ap.propuestas[p.id] ?? []}
              pdf={p.pdf ?? ap.programas?.[p.id]?.url ?? null}
              elegido={voto[ap.id] === p.id}
              onElegir={() => elegir(p.id)}
            />
          ))}
        </div>

        <article id="partido-rc" className="scroll-mt-[150px] rounded-[18px] p-[3px]" style={{ background: 'linear-gradient(120deg,#8B30D9,#C3369E,#E8792F,#16B8A0,#2BC7E8)' }}>
          <div className="flex flex-col gap-3 rounded-[15px] bg-white px-6 py-6">
            <p className="text-[12px] font-bold uppercase tracking-[.12em]" style={{ color: '#0E8C7A' }}>La alternativa de Razón Común</p>
            {rc[ap.id]?.length ? (
              <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2">
                {rc[ap.id].map((x, i) => {
                  // Sin círculo: Razón Común no se pone nota a sí misma.
                  const v = { color: '#5B5B5B', etiqueta: '' };
                  return (
                    <div key={i} className="flex flex-col gap-2 rounded-[14px] border border-linea px-4 py-4">
                      <p className="flex gap-2.5 text-[15px] font-bold leading-snug text-titular">
                        <span>{x.titulo}</span>
                      </p>
                      <EstadoSeguimiento s={x.seguimiento} />
                      <p className="text-[14px] leading-[1.5] text-cuerpo">{x.texto}</p>
                      <details className="group rounded-[10px] border border-linea bg-white px-3 py-2.5">
                        <summary className="flex min-h-[28px] cursor-pointer list-none items-center justify-between text-[10.5px] font-extrabold uppercase tracking-[.1em] text-titular">
                          El problema y cómo se mide
                          <span aria-hidden="true" className="transition group-open:rotate-180">▾</span>
                        </summary>
                        <div className="mt-1.5 space-y-1.5 text-[13px] leading-[1.45] text-cuerpo">
                          {x.dato ? (
                            <p>
                              <span className="font-bold">El problema:</span> {x.dato.texto}{' '}
                              <a href={x.dato.url} target="_blank" rel="noopener nofollow" className="text-[11.5px] underline">{x.dato.fuente}</a>
                            </p>
                          ) : null}
                          <p><span className="font-bold">Cómo se mide:</span> {x.medicion}</p>
                          <p>
                            <span className="font-bold">Quién lo hace:</span> {x.competencia}
                            {x.punto ? <> · <a href="/manifiesto" className="underline">Punto {x.punto} del manifiesto</a></> : null}
                          </p>
                        </div>
                      </details>
                      <Verificacion v={v} titulo="Riesgos y límites" texto={x.verificacion.texto} fuentes={x.verificacion.fuentes} />
                      <BloqueViabilidad b={x.viabilidad} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[15px] italic text-gris">En desarrollo: la estamos elaborando con datos y la publicaremos aquí.</p>
            )}
            <div className="flex flex-wrap items-center gap-4">
              <a href="/manifiesto" className="text-[13px] font-bold underline">Ver los 30 puntos del manifiesto →</a>
              {rc[ap.id]?.length ? <BotonVoto activo={voto[ap.id] === 'rc'} onClick={() => elegir('rc')} /> : null}
            </div>
          </div>
        </article>

        <section className="rounded-[18px] border border-linea bg-white p-6">
          <h2 className="text-[20px] font-extrabold text-titular">Tu afinidad</h2>
          <p className="mt-1 text-[13.5px] text-gris">
            Pulsa «Me convence» en la propuesta que prefieras de cada apartado. Llevas {respondidos} de {apartados.length}. Solo lo ves tú: no se guarda.
          </p>
          {respondidos > 0 ? (
            <div className="mt-5 space-y-2.5">
              {[...partidos, { id: 'rc', nombre: 'Razón Común', color: RC_COLOR, sigla: 'RC' }]
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
        </section>
      </div>
    </div>
  );
}

function Leyenda() {
  return (
    <div className="mt-4 space-y-1.5 rounded-[12px] border border-linea bg-white px-3.5 py-3 text-[12px] text-cuerpo">
      <p className="font-bold uppercase tracking-wide text-gris">Análisis de Razón Común</p>
      {(Object.keys(VEREDICTO) as Veredicto[]).map((k) => (
        <p key={k} className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ background: VEREDICTO[k].color }} /> {VEREDICTO[k].etiqueta}
        </p>
      ))}
    </div>
  );
}

function BotonVoto({ activo, onClick }: { activo: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={activo}
      className="min-h-[44px] self-start rounded-[10px] border-[1.5px] border-titular px-4 text-[13px] font-bold"
      style={activo ? { background: '#1B3D9C', color: '#fff' } : { background: '#fff', color: '#1B3D9C' }}
    >
      {activo ? '✓ Me convence' : 'Me convence esta'}
    </button>
  );
}

function TarjetaPartido({
  partido, propuestas, pdf, elegido, onElegir,
}: { partido: Partido; propuestas: PropuestaVerificada[]; pdf: string | null; elegido: boolean; onElegir: () => void }) {
  // Misma extensión para todos: 3 propuestas a la vista; el resto, a demanda.
  const [todas, setTodas] = useState(false);
  const visiblesP = todas ? propuestas : propuestas.slice(0, 3);
  return (
    <article
      id={`partido-${partido.id}`}
      className="flex scroll-mt-[150px] flex-col gap-3.5 rounded-[16px] bg-white px-5 py-5"
      style={{ border: `1px solid ${elegido ? partido.color : '#E4E6EE'}`, boxShadow: elegido ? `0 0 0 2px ${partido.color}` : '0 1px 2px rgba(27,61,156,.06)' }}
    >
      <div className="flex items-center gap-2.5">
        <span className="inline-flex h-[26px] min-w-[44px] items-center justify-center rounded-full px-2 text-[11px] font-extrabold text-white" style={{ background: partido.color }}>
          {partido.sigla}
        </span>
        <h3 className="text-[16px] font-extrabold text-titular">{partido.nombre}</h3>
        {pdf ? (
          <a
            href={pdf}
            target="_blank"
            rel="noopener nofollow"
            aria-label={`Descargar el programa de ${partido.nombre} en PDF`}
            className="ml-auto inline-flex min-h-[44px] items-center gap-1.5 rounded-[10px] px-2.5 text-[11.5px] font-extrabold tracking-[.08em] no-underline"
            style={{ color: '#B3261E' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
              <text x="12" y="17.5" textAnchor="middle" fontSize="6" fontWeight="800" fill="currentColor" stroke="none">PDF</text>
            </svg>
            DESCARGAR
          </a>
        ) : null}
      </div>

      {propuestas.length === 0 ? (
        <p className="text-[14px] italic text-gris">No hemos encontrado propuesta concreta sobre este apartado en su programa.</p>
      ) : (
        <div className="flex flex-col gap-3.5">
          {visiblesP.map((x, i) => {
            const v = VEREDICTO[x.verificacion.veredicto] ?? VEREDICTO.naranja;
            const href = enlacePdf(pdf, x.cita.pagina);
            const cita = x.cita.pagina
              ? `Programa ${partido.nombre} 2026 · pág. ${x.cita.pagina}${x.cita.apartado ? `, ${x.cita.apartado}` : ''}`
              : 'Página por confirmar';
            // Una nota con URL pegada («Tomado de prensa (https://…)») se pinta como «Fuente ↗».
            const urlNota = (x.cita.nota ?? '').match(/https?:\/\/[^\s)]+/)?.[0] ?? null;
            const prefijoNota = urlNota ? (x.cita.nota ?? '').split(urlNota)[0].replace(/[\s(]+$/, '').trim() : '';
            return (
              <div key={i} className="flex flex-col gap-2 border-b border-linea pb-3.5 last:border-0 last:pb-0">
                <p className="flex gap-2.5 text-[14.5px] font-bold leading-[1.45] text-titular">
                  <span className="mt-[5px] h-3 w-3 flex-none rounded-full" style={{ background: v.color }} title={v.etiqueta} aria-label={`Verificación: ${v.etiqueta}`} role="img" />
                  <span>«{x.texto}»</span>
                </p>
                {urlNota ? (
                  <p className="pl-[22px] text-[12px] text-gris">
                    {prefijoNota ? <>{prefijoNota} </> : null}(
                    <a href={urlNota} target="_blank" rel="noopener nofollow" className="inline-flex items-center gap-1 font-semibold underline">
                      Fuente
                      <Icono size={13} d={['M14 4h6v6', 'M20 4l-9 9', 'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5']} />
                    </a>
                    )
                  </p>
                ) : href ? (
                  <a href={href} target="_blank" rel="noopener nofollow" className="inline-flex items-center gap-1.5 pl-[22px] text-[12px] font-semibold text-gris">
                    <Icono size={14} d={['M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z', 'M14 3v5h5']} />
                    {cita}
                  </a>
                ) : (
                  <span className="pl-[22px] text-[12px] font-semibold text-gris" title={x.cita.nota ?? undefined}>{cita}</span>
                )}
                <LineaFicha f={x.ficha} />
                <div className="ml-[22px]"><Verificacion v={v} texto={x.verificacion.texto} fuentes={x.verificacion.fuentes} /></div>
                <div className="ml-[22px]"><BloqueViabilidad b={x.viabilidad} /></div>
                <div className="ml-[22px]"><EstadoSeguimiento s={x.seguimiento} /></div>
              </div>
            );
          })}
          {propuestas.length > 3 ? (
            <button onClick={() => setTodas((t) => !t)} className="self-start pl-[22px] text-[12.5px] font-bold text-titular underline">
              {todas ? 'Ver menos' : `Ver ${propuestas.length - 3} más`}
            </button>
          ) : null}
        </div>
      )}
      <div className="mt-auto pt-1">
        <BotonVoto activo={elegido} onClick={onElegir} />
      </div>
    </article>
  );
}

function Verificacion({ v, texto, fuentes, titulo }: { v: { color: string; etiqueta: string }; texto: string; fuentes?: Fuente[]; titulo?: string }) {
  return (
    <details className="group rounded-[10px] px-3 py-2.5" style={{ background: `${v.color}14` }}>
      <summary className="flex min-h-[28px] cursor-pointer list-none items-center justify-between text-[10.5px] font-extrabold uppercase tracking-[.1em]" style={{ color: v.color === '#E8792F' ? '#A2470F' : v.color }}>
        {titulo ?? `Análisis de Razón Común · ${v.etiqueta}`}
        <span aria-hidden="true" className="transition group-open:rotate-180">▾</span>
      </summary>
      <p className="mt-1.5 text-[13px] leading-[1.45] text-cuerpo">{texto}</p>
      {fuentes?.length ? (
        <p className="mt-1.5 flex flex-wrap gap-x-3 text-[11.5px]">
          {fuentes.map((f, j) => (
            <a key={j} href={f.url} target="_blank" rel="noopener nofollow" className="underline">{f.nombre}</a>
          ))}
        </p>
      ) : null}
    </details>
  );
}

const ESTADO: Record<string, { etiqueta: string; color: string }> = {
  en_curso: { etiqueta: 'En curso', color: '#1B3D9C' },
  cumplida: { etiqueta: 'Cumplida', color: '#1E9E5A' },
  parcial: { etiqueta: 'Cumplida en parte', color: '#A2470F' },
  incumplida: { etiqueta: 'Incumplida', color: '#D0342C' },
};

/** Seguimiento de la legislatura. «Pendiente» (o sin dato) no se pinta. */
function EstadoSeguimiento({ s }: { s?: Seguimiento }) {
  const e = s && ESTADO[s.estado];
  if (!e) return null;
  return (
    <p className="text-[12px] font-bold" style={{ color: e.color }}>
      ● {e.etiqueta}{s?.fecha ? ` · ${s.fecha}` : ''}
      {s?.fuente ? <> · <a href={s.fuente.url} target="_blank" rel="noopener nofollow" className="underline">{s.fuente.nombre}</a></> : null}
      {s?.nota ? <span className="font-normal text-gris"> — {s.nota}</span> : null}
    </p>
  );
}

/** Acordeón «Viabilidad»: coste estimado, consecuencias y precedentes en otros países. */
function BloqueViabilidad({ b }: { b?: Viabilidad }) {
  if (!b || (!b.texto && !b.coste)) return null;
  return (
    <details className="group rounded-[10px] border border-linea bg-white px-3 py-2.5">
      <summary className="flex min-h-[28px] cursor-pointer list-none items-center justify-between text-[10.5px] font-extrabold uppercase tracking-[.1em] text-titular">
        Viabilidad: coste y consecuencias
        <span aria-hidden="true" className="transition group-open:rotate-180">▾</span>
      </summary>
      {b.coste ? <p className="mt-1.5 text-[13px] font-bold text-titular">Coste: {b.coste}</p> : null}
      {b.texto ? <p className="mt-1.5 text-[13px] leading-[1.45] text-cuerpo">{b.texto}</p> : null}
      {b.precedentes?.length ? (
        <ul className="mt-2 space-y-1.5">
          {b.precedentes.map((p, i) => (
            <li key={i} className="text-[12.5px] leading-[1.4] text-cuerpo">
              <span className="font-bold">{p.pais}:</span> {p.resultado}{' '}
              <a href={p.url} target="_blank" rel="noopener nofollow" className="text-[11.5px] underline">fuente</a>
            </li>
          ))}
        </ul>
      ) : null}
      {b.fuentes?.length ? (
        <p className="mt-1.5 flex flex-wrap gap-x-3 text-[11.5px]">
          {b.fuentes.map((f, j) => (
            <a key={j} href={f.url} target="_blank" rel="noopener nofollow" className="underline">{f.nombre}</a>
          ))}
        </p>
      ) : null}
    </details>
  );
}

const COSTE: Record<string, string> = {
  partido_no_da: 'el partido no lo da',
  sin_estimacion_oficial: 'sin estimación oficial',
  pendiente: 'pendiente de localizar',
};

/** Una línea gris: competencia · coste · plazo. Descriptiva: no cambia el color. */
function LineaFicha({ f }: { f?: Ficha }) {
  if (!f) return null;
  const coste = f.coste
    ? f.coste.estado === 'cifra' && f.coste.texto
      ? f.coste.texto
      : COSTE[f.coste.estado] ?? null
    : null;
  const partes: React.ReactNode[] = [];
  if (f.competencia) partes.push(<span key="c"><b className="font-semibold">Competencia:</b> {f.competencia}</span>);
  if (coste)
    partes.push(
      <span key="k">
        <b className="font-semibold">Coste:</b>{' '}
        {f.coste?.fuente ? <a href={f.coste.fuente.url} target="_blank" rel="noopener nofollow" className="underline">{coste}</a> : coste}
      </span>,
    );
  partes.push(<span key="p"><b className="font-semibold">Plazo:</b> {f.plazo || 'no especificado'}</span>);
  return (
    <p className="flex flex-wrap gap-x-3 gap-y-0.5 pl-[22px] text-[11.5px] leading-[1.4] text-gris">{partes}</p>
  );
}
