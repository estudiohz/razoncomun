'use client';

import { useEffect, useState } from 'react';
import { useVista } from './vista';
import { BloqueAfinidad, Flechas, claveVoto, useVotos } from './votos';
import { COLOR_APARTADO, type Apartado, type Partido, type PropuestaRc, type PropuestaVerificada, type Seguimiento, type Veredicto, type Fuente, type Viabilidad, type Ficha } from './tipos';

const VEREDICTO: Record<Veredicto, { color: string; etiqueta: string }> = {
  verde: { color: '#1E9E5A', etiqueta: 'Posible' },
  naranja: { color: '#E8792F', etiqueta: 'Con matices' },
  rojo: { color: '#D0342C', etiqueta: 'Inviable tal cual' },
  gris: { color: '#8A8F9C', etiqueta: 'No evaluable' },
};
const RC_COLOR = '#16B8A0';
// Degradado corporativo (indicado por Sergio).
const GRADIENTE = 'linear-gradient(123deg, #0e57a5, #5158a7 30%, #a52b8ebf 50%, #ed1156b5 60%, #f05726bd 85%, #ed7547)';

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
 * Comparador por apartados. Flechas por propuesta = voto privado del
 * visitante: estado React, ni localStorage ni servidor (RGPD Art. 9).
 */
export function Comparador({ apartados, partidos, rc }: { apartados: Apartado[]; partidos: Partido[]; rc: Record<string, PropuestaRc[]> }) {
  const [sel, setSel] = useState(0);
  const [vista] = useVista();
  const columnas = vista === 'columnas';
  const { votos } = useVotos();
  const votadoEn = (id: string) => Object.keys(votos).some((k) => k.startsWith(`${id}|`));
  // Cara a cara: qué partidos se ven (mínimo uno).
  const [visibles, setVisibles] = useState<string[]>(partidos.map((p) => p.id));
  const alternar = (id: string) =>
    setVisibles((v) => (v.includes(id) ? (v.length > 1 ? v.filter((x) => x !== id) : v) : [...v, id]));
  // Orden barajado una vez por visita, tras montar (no rompe la hidratación).
  const [orden, setOrden] = useState(partidos);
  useEffect(() => setOrden([...partidos].sort(() => Math.random() - 0.5)), [partidos]);

  const ap = apartados[sel];
  const color = COLOR_APARTADO[ap?.id ?? ''] ?? '#1B3D9C';
  if (!ap) return null;


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
                {String(i + 1).padStart(2, '0')} · {a.titulo}{votadoEn(a.id) ? ' ✓' : ''}
              </option>
            ))}
          </select>
          <span aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-titular">▾</span>
        </div>
      </div>

      {columnas ? (
        <nav aria-label="Apartados" className="hidden w-full min-[900px]:block">
          <div className="grid grid-cols-4 gap-2.5 min-[1180px]:grid-cols-6">
            {apartados.map((a, i) => {
              const c = COLOR_APARTADO[a.id] ?? '#1B3D9C';
              const activo = i === sel;
              return (
                <button
                  key={a.id}
                  onClick={() => setSel(i)}
                  aria-pressed={activo}
                  className="flex min-h-[64px] flex-col items-start justify-center rounded-[14px] border px-4 py-3 text-left transition-colors"
                  style={activo ? { background: c, borderColor: c, color: '#fff' } : { background: '#fff', borderColor: '#E4E6EE', color: '#1B3D9C' }}
                >
                  <span className="flex w-full items-center gap-2 text-[14px] font-extrabold">
                    <span className="text-[12px] opacity-80">{String(i + 1).padStart(2, '0')}</span>
                    <span className="flex-1">{a.titulo}</span>
                    {votadoEn(a.id) ? <span aria-label="has votado aquí">✓</span> : null}
                  </span>
                  <span className="mt-1 flex items-center gap-1.5 text-[11.5px] font-semibold" style={{ opacity: activo ? 0.9 : 0.75 }}>
                    {activo ? null : <span className="h-2 w-2 rounded-full" style={{ background: c }} />}
                    {Object.values(a.propuestas).reduce((n, l) => n + l.length, 0)} propuestas
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      ) : (
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
              <span className="text-[11px] font-semibold text-gris">{votadoEn(a.id) ? '✓' : String(i + 1).padStart(2, '0')}</span>
            </button>
          );
        })}
        <Leyenda />
      </nav>
      )}

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

        <div
          className={columnas ? 'grid grid-cols-1 items-start gap-4 min-[640px]:grid-cols-2 min-[1100px]:[grid-template-columns:var(--cols)]' : 'grid grid-cols-1 gap-4 min-[640px]:grid-cols-2'}
          style={columnas ? ({ '--cols': `repeat(${visibles.length}, minmax(0, 1fr))` } as React.CSSProperties) : undefined}
        >
          {orden.filter((p) => visibles.includes(p.id)).map((p) => (
            <TarjetaPartido
              key={p.id}
              partido={p}
              propuestas={ap.propuestas[p.id] ?? []}
              pdf={p.pdf ?? ap.programas?.[p.id]?.url ?? null}
              apartado={ap.id}
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
                      <div className="mt-auto pt-1"><Flechas clave={claveVoto(ap.id, 'rc', i)} /></div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[15px] italic text-gris">En desarrollo: la estamos elaborando con datos y la publicaremos aquí.</p>
            )}
            <div className="flex flex-wrap items-center gap-4">
              <a href="/manifiesto" className="text-[13px] font-bold underline">Ver los 30 puntos del manifiesto →</a>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-4 rounded-[14px] px-5 py-4" style={{ background: 'linear-gradient(120deg,rgba(139,48,217,.10),rgba(22,184,160,.12))' }}>
              <p className="text-[15px] font-bold leading-snug text-titular">Si te gusta nuestra forma de pensar y quieres participar</p>
              <a
                href="/registro"
                className="inline-flex min-h-[48px] items-center rounded-boton px-6 text-[15px] font-bold text-white no-underline shadow-boton"
                style={{ background: 'linear-gradient(120deg,#6A1FB8,#8B30D9 45%,#C3369E)' }}
              >
                Regístrate
              </a>
            </div>
          </div>
        </article>

        <BloqueAfinidad fuerzas={[...partidos.map((p) => ({ id: p.id, nombre: p.nombre, color: p.color })), { id: 'rc', nombre: 'Razón Común', color: RC_COLOR }]} />
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

function TarjetaPartido({
  partido, propuestas, pdf, apartado,
}: { partido: Partido; propuestas: PropuestaVerificada[]; pdf: string | null; apartado: string }) {
  // Misma extensión para todos: 3 propuestas a la vista; el resto, a demanda.
  const [todas, setTodas] = useState(false);
  const visiblesP = todas ? propuestas : propuestas.slice(0, 3);
  return (
    <article
      id={`partido-${partido.id}`}
      className="flex scroll-mt-[150px] flex-col gap-3.5 rounded-[16px] bg-white px-5 py-5"
      style={{ border: '1px solid #E4E6EE', boxShadow: '0 1px 2px rgba(27,61,156,.06)' }}
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
      <BarraVeredictos propuestas={propuestas} />

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
                <p className="text-[14.5px] font-bold leading-[1.45] text-titular">«{x.texto}»</p>
                {/* Solo «Fuente», enlazada; el origen exacto va en el tooltip. */}
                {urlNota || href ? (
                  <a
                    href={urlNota ?? href ?? undefined}
                    target="_blank"
                    rel="noopener nofollow"
                    title={urlNota ? prefijoNota || 'Tomado de prensa' : cita}
                    className="inline-flex items-center gap-1 self-start text-[12px] font-semibold text-gris underline"
                  >
                    Fuente
                    <Icono size={13} d={['M14 4h6v6', 'M20 4l-9 9', 'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5']} />
                  </a>
                ) : (
                  <span className="self-start text-[12px] font-semibold text-gris" title={x.cita.nota ?? cita}>Fuente por confirmar</span>
                )}
                <div><Verificacion v={v} texto={x.verificacion.texto} fuentes={x.verificacion.fuentes} /></div>
                <div><BloqueViabilidad b={x.viabilidad} f={x.ficha} /></div>
                <div><EstadoSeguimiento s={x.seguimiento} /></div>
                <Flechas clave={claveVoto(apartado, partido.id, propuestas.indexOf(x))} />
              </div>
            );
          })}
          {propuestas.length > 3 ? (
            <button onClick={() => setTodas((t) => !t)} className="self-start text-[12.5px] font-bold text-titular underline">
              {todas ? 'Ver menos' : `Ver ${propuestas.length - 3} más`}
            </button>
          ) : null}
        </div>
      )}
    </article>
  );
}

function Verificacion({ v, texto, fuentes, titulo }: { v: { color: string; etiqueta: string }; texto: string; fuentes?: Fuente[]; titulo?: string }) {
  return (
    <details className="group rounded-[10px] px-3 py-2.5" style={{ background: `${v.color}14` }}>
      <summary className="flex min-h-[28px] cursor-pointer list-none items-center justify-between text-[10.5px] font-extrabold uppercase tracking-[.1em]" style={{ color: v.color === '#E8792F' ? '#A2470F' : v.color }}>
        <span className="flex min-w-0 items-center gap-2 whitespace-nowrap">
          {titulo ? null : <span className="h-3 w-3 flex-none rounded-full" style={{ background: v.color }} aria-hidden="true" />}
          <span className="truncate">{titulo ?? `Análisis ${v.etiqueta.toLowerCase()} (RC)`}</span>
        </span>
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
function BloqueViabilidad({ b, f }: { b?: Viabilidad; f?: Ficha }) {
  if ((!b || (!b.texto && !b.coste)) && !f) return null;
  return (
    <details className="group rounded-[10px] border border-linea bg-white px-3 py-2.5">
      <summary className="flex min-h-[28px] cursor-pointer list-none items-center justify-between text-[10.5px] font-extrabold uppercase tracking-[.1em] text-titular">
        Viabilidad
        <span aria-hidden="true" className="transition group-open:rotate-180">▾</span>
      </summary>
      {f ? <div className="mt-1.5"><LineaFicha f={f} /></div> : null}
      {b?.coste ? <p className="mt-1.5 text-[13px] font-bold text-titular">Coste: {b.coste}</p> : null}
      {b?.texto ? <p className="mt-1.5 text-[13px] leading-[1.45] text-cuerpo">{b.texto}</p> : null}
      {b?.precedentes?.length ? (
        <ul className="mt-2 space-y-1.5">
          {b.precedentes.map((p, i) => (
            <li key={i} className="text-[12.5px] leading-[1.4] text-cuerpo">
              <span className="font-bold">{p.pais}:</span> {p.resultado}{' '}
              <a href={p.url} target="_blank" rel="noopener nofollow" className="text-[11.5px] underline">fuente</a>
            </li>
          ))}
        </ul>
      ) : null}
      {b?.fuentes?.length ? (
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
    <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] leading-[1.4] text-gris">{partes}</p>
  );
}

/** Barra tipo «loader» bajo el nombre del partido: un tramo por veredicto, con su número dentro. */
function BarraVeredictos({ propuestas }: { propuestas: PropuestaVerificada[] }) {
  if (!propuestas.length) return null;
  const orden: Veredicto[] = ['verde', 'naranja', 'rojo', 'gris'];
  const n = (k: Veredicto) => propuestas.filter((x) => (x.verificacion.veredicto ?? 'naranja') === k).length;
  const tramos = orden.map((k) => ({ k, c: n(k) })).filter((t) => t.c > 0);
  const resumen = tramos.map((t) => `${t.c} ${VEREDICTO[t.k].etiqueta.toLowerCase()}`).join(' · ');
  // Texto oscuro sobre naranja/gris claro y blanco sobre verde/rojo: contraste legible.
  const tinta: Record<Veredicto, string> = { verde: '#FFFFFF', naranja: '#2B1300', rojo: '#FFFFFF', gris: '#FFFFFF' };
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-[22px] gap-[3px] overflow-hidden rounded-full" role="img" aria-label={`${propuestas.length} propuestas: ${resumen}`}>
        {tramos.map((t) => (
          <span
            key={t.k}
            className="flex min-w-[26px] items-center justify-center text-[12px] font-extrabold tabular-nums"
            style={{ flexGrow: t.c, flexBasis: 0, background: VEREDICTO[t.k].color, color: tinta[t.k] }}
          >
            {t.c}
          </span>
        ))}
      </div>
      <p className="text-[12px] text-gris">{resumen}</p>
    </div>
  );
}

/** Leyenda en línea para el diseño en columnas: va junto a «Cómo lo hemos hecho» para no empujar el contenido hacia abajo. */
export function LeyendaSiColumnas() {
  const [vista] = useVista();
  if (vista !== 'columnas') return null;
  return (
    <div className="hidden flex-wrap items-center gap-x-4 gap-y-1.5 rounded-[12px] border border-linea bg-white px-4 py-3 text-[12.5px] text-cuerpo min-[900px]:flex">
      <span className="text-[11px] font-bold uppercase tracking-[.1em] text-gris">Análisis</span>
      {(Object.keys(VEREDICTO) as Veredicto[]).map((k) => (
        <span key={k} className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full" style={{ background: VEREDICTO[k].color }} /> {VEREDICTO[k].etiqueta}
        </span>
      ))}
    </div>
  );
}
