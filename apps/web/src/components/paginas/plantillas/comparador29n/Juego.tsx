'use client';

import { useMemo, useState } from 'react';
import { COLOR_APARTADO, type Apartado, type Partido, type PropuestaRc } from './tipos';
import { BloqueAfinidad, Flechas, calcularAfinidad, claveVoto, useVotos } from './votos';

const RC = { id: 'rc', nombre: 'Razón Común', color: '#16B8A0' };

interface Ficha { clave: string; fuerza: string; texto: string }

function barajar<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Juego a ciegas: propuestas de todas las fuerzas mezcladas, sin logo, color
 * ni semáforo (el semáforo delataría a Razón Común, que no se puntúa). Texto
 * tal cual lo escribe cada fuerza. Al final se desvela de quién era cada una.
 * Se monta solo en cliente (al elegir el modo), así que barajar aquí no rompe la hidratación.
 */
export function Juego({
  apartados, partidos, rc, onSalir,
}: { apartados: Apartado[]; partidos: Partido[]; rc: Record<string, PropuestaRc[]>; onSalir: () => void }) {
  const { votos, reiniciar } = useVotos();
  const [paso, setPaso] = useState(0);
  const [desvelado, setDesvelado] = useState(false);

  const rondas = useMemo(
    () =>
      apartados.map((ap) => {
        const fichas: Ficha[] = [];
        for (const p of partidos) (ap.propuestas[p.id] ?? []).forEach((x, i) => fichas.push({ clave: claveVoto(ap.id, p.id, i), fuerza: p.id, texto: x.texto }));
        (rc[ap.id] ?? []).forEach((x, i) => fichas.push({ clave: claveVoto(ap.id, 'rc', i), fuerza: 'rc', texto: x.texto }));
        return { ap, fichas: barajar(fichas) };
      }),
    [apartados, partidos, rc],
  );
  const fuerzas = [...partidos.map((p) => ({ id: p.id, nombre: p.nombre, color: p.color })), RC];
  const nombre = (id: string) => fuerzas.find((f) => f.id === id);
  const total = Object.keys(votos).length;

  if (desvelado) {
    const top = calcularAfinidad(votos, fuerzas).filter((f) => f.votadas);
    const compartir = async () => {
      const texto = `He jugado a ciegas al comparador del 29N: coincido más con ${top[0]?.nombre ?? '…'}. ¿Y tú? Prueba sin saber de quién es cada propuesta:`;
      const url = `${location.origin}${location.pathname}?modo=juego`;
      try {
        if (navigator.share) await navigator.share({ text: texto, url });
        else await navigator.clipboard.writeText(`${texto} ${url}`);
      } catch {
        /* el usuario canceló */
      }
    };
    return (
      <div className="flex flex-col gap-6">
        <div className="rounded-[20px] p-[3px]" style={{ background: 'linear-gradient(120deg,#8B30D9,#C3369E,#E8792F,#16B8A0,#2BC7E8)' }}>
          <div className="rounded-[17px] bg-white px-6 py-7 text-center">
            <p className="text-[12px] font-bold uppercase tracking-[.14em] text-gris">Resultado a ciegas</p>
            <h2 className="mt-2 text-[clamp(26px,4vw,40px)] font-extrabold leading-tight text-titular">
              {top[0] ? <>Coincides más con <span style={{ color: top[0].color }}>{top[0].nombre}</span></> : 'No has votado ninguna propuesta'}
            </h2>
            <p className="mx-auto mt-2 max-w-[560px] text-[14.5px] text-cuerpo">Has juzgado {total} propuestas por lo que dicen, no por quién las firma. Abajo tienes de quién era cada una.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={compartir} className="min-h-[48px] rounded-boton border-[1.5px] border-titular px-5 text-[14px] font-bold text-titular">Compartir resultado</button>
              <button type="button" onClick={onSalir} className="min-h-[48px] rounded-boton px-5 text-[14px] font-bold text-white" style={{ background: '#1B3D9C' }}>Ver el comparador completo</button>
            </div>
          </div>
        </div>

        <BloqueAfinidad fuerzas={fuerzas} titulo="Tu afinidad, desvelada" texto="Me gusta menos no me gusta, entre las propuestas que votaste de cada fuerza." />

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-[16px] px-6 py-5" style={{ background: 'linear-gradient(120deg,rgba(139,48,217,.10),rgba(22,184,160,.12))' }}>
          <p className="max-w-[640px] text-[15.5px] font-bold leading-snug text-titular">¿Te ha sorprendido? En Razón Común las propuestas se votan así: por ideas, no por siglas. Regístrate y vota las nuestras.</p>
          <a href="/registro" className="inline-flex min-h-[48px] items-center rounded-boton px-6 text-[15px] font-bold text-white no-underline shadow-boton" style={{ background: 'linear-gradient(120deg,#6A1FB8,#8B30D9 45%,#C3369E)' }}>Regístrate</a>
        </div>

        <section className="flex flex-col gap-6">
          {rondas.map(({ ap, fichas }) => {
            const votadas = fichas.filter((f) => votos[f.clave]);
            if (!votadas.length) return null;
            return (
              <div key={ap.id}>
                <h3 className="mb-3 text-[18px] font-extrabold text-titular">{ap.titulo}</h3>
                <ul className="grid gap-3 min-[760px]:grid-cols-2">
                  {votadas.map((f) => {
                    const q = nombre(f.fuerza);
                    return (
                      <li key={f.clave} className="rounded-[14px] border border-linea bg-white px-4 py-3.5">
                        <p className="flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-[.08em]" style={{ color: q?.color }}>
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: q?.color }} />
                          {q?.nombre}
                          <span className="ml-auto text-[13px]" style={{ color: votos[f.clave] === 1 ? '#1E9E5A' : '#D0342C' }}>{votos[f.clave] === 1 ? '▲ te gustó' : '▼ no te gustó'}</span>
                        </p>
                        <p className="mt-1.5 text-[14px] leading-snug text-cuerpo">«{f.texto}»</p>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </section>
        <button type="button" onClick={() => { reiniciar(); setPaso(0); setDesvelado(false); }} className="self-start text-[13px] font-bold text-gris underline">Volver a jugar</button>
      </div>
    );
  }

  const { ap, fichas } = rondas[paso];
  const color = COLOR_APARTADO[ap.id] ?? '#1B3D9C';
  const ultimo = paso === rondas.length - 1;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2" aria-label={`Apartado ${paso + 1} de ${rondas.length}`}>
          {rondas.map((r, i) => (
            <span key={r.ap.id} className="h-2 rounded-full transition-all" style={{ width: i === paso ? 28 : 10, background: i <= paso ? (COLOR_APARTADO[r.ap.id] ?? '#1B3D9C') : '#E4E6EE' }} />
          ))}
        </div>
        <button type="button" onClick={onSalir} className="text-[13px] font-bold text-gris underline">Salir del juego</button>
      </div>

      <div className="rounded-[18px] px-7 py-6 text-titular" style={{ background: `${color}24`, borderTop: `6px solid ${color}` }}>
        <p className="text-[12px] font-bold uppercase tracking-[.12em] opacity-85">Ronda {paso + 1} de {rondas.length}</p>
        <h2 className="mt-1 text-[clamp(24px,3.4vw,32px)] font-extrabold">{ap.titulo}</h2>
        <p className="mt-1 text-[14px] text-cuerpo">{fichas.length} propuestas mezcladas. Vota las que quieras: no sabes de quién son.</p>
      </div>

      <ul className="grid gap-3 min-[760px]:grid-cols-2">
        {fichas.map((f, i) => (
          <li key={f.clave} className="flex flex-col gap-3 rounded-[14px] border border-linea bg-white px-4 py-4">
            <p className="text-[11px] font-extrabold uppercase tracking-[.12em] text-gris">Propuesta {String.fromCharCode(65 + (i % 26))}</p>
            <p className="flex-1 text-[15px] font-semibold leading-snug text-titular">«{f.texto}»</p>
            <Flechas clave={f.clave} />
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" disabled={paso === 0} onClick={() => setPaso((p) => p - 1)} className="min-h-[48px] rounded-boton border border-linea px-5 text-[14px] font-bold text-titular disabled:opacity-40">← Anterior</button>
        <span className="text-[13px] text-gris">Llevas {total} votadas</span>
        {ultimo ? (
          <button type="button" onClick={() => { setDesvelado(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="min-h-[48px] rounded-boton px-6 text-[15px] font-bold text-white shadow-boton" style={{ background: 'linear-gradient(120deg,#6A1FB8,#8B30D9 45%,#C3369E)' }}>
            Desvelar resultados
          </button>
        ) : (
          <button type="button" onClick={() => { setPaso((p) => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="min-h-[48px] rounded-boton px-6 text-[15px] font-bold text-white" style={{ background: '#1B3D9C' }}>
            Siguiente →
          </button>
        )}
      </div>
    </div>
  );
}
