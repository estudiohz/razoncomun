'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  actualizarEncuestaAction,
  anadirPreguntaAction,
  guardarPreguntaAction,
  eliminarPreguntaAction,
  type ResultadoEdicion,
} from './actions';

export interface PreguntaEditor {
  id: string;
  position: number;
  kind: string;
  text: string;
  options: string[] | null;
  info: string | null;
  proposal_slug: string | null;
  respuestas: number;
}

export interface EncuestaEditor {
  id: string;
  title: string;
  description: string | null;
  closes_at: string;
  results_visibility: string;
  featured_month: string | null;
  audience: string;
  anonymous: boolean;
}

const TIPO: Record<string, string> = {
  single: 'Respuesta única',
  multiple: 'Respuesta múltiple',
  scale: 'Escala (1-5)',
  text: 'Texto libre',
};

const input =
  'w-full rounded-boton border border-linea bg-white px-4 py-2.5 text-[14px] text-titular';
const label = 'mb-1 block text-[12px] font-bold text-gris';
const botonPrimario =
  'rounded-boton bg-accion px-5 py-2.5 text-[13.5px] font-bold text-white shadow-boton disabled:opacity-50';

function paraInputLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Editor de encuesta móvil-primero (02/08/2026): tarjetas apiladas, inputs a
 * todo el ancho, un "Guardar" por bloque (nada de un formulario gigante que
 * en el móvil no se sabe dónde termina). Las reglas de sellado viven en las
 * actions; aquí solo se reflejan (campos bloqueados con su porqué).
 */
export function EditorEncuestaClient({
  encuesta,
  preguntas,
}: {
  encuesta: EncuestaEditor;
  preguntas: PreguntaEditor[];
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<{ zona: string; r: ResultadoEdicion } | null>(null);
  const [anadiendo, setAnadiendo] = useState(false);

  function correr(zona: string, fn: () => Promise<ResultadoEdicion>, tras?: () => void) {
    setAviso(null);
    iniciar(async () => {
      const r = await fn();
      setAviso({ zona, r });
      if (r.ok) {
        tras?.();
        router.refresh();
      }
    });
  }

  const Aviso = ({ zona }: { zona: string }) =>
    aviso && aviso.zona === zona ? (
      <p
        className={`mt-3 rounded-boton px-3.5 py-2.5 text-[13px] font-medium ${aviso.r.ok ? 'bg-teal/10 text-titular' : 'bg-magenta/10 text-magenta'}`}
      >
        {aviso.r.ok ? 'Guardado.' : aviso.r.error}
      </p>
    ) : null;

  return (
    <div className="space-y-5">
      {/* Datos generales */}
      <section className="rounded-tarjeta border border-linea bg-panel p-5">
        <h2 className="text-[13px] font-bold uppercase tracking-[.08em] text-gris">Datos</h2>
        <form action={(fd) => correr('datos', () => actualizarEncuestaAction(encuesta.id, fd))} className="mt-3 space-y-3">
          <div>
            <label className={label}>Título</label>
            <input name="title" defaultValue={encuesta.title} required minLength={6} className={input} />
          </div>
          <div>
            <label className={label}>Descripción</label>
            <textarea name="description" defaultValue={encuesta.description ?? ''} rows={2} className={input} />
          </div>
          <div className="grid gap-3 min-[480px]:grid-cols-2">
            <div>
              <label className={label}>Cierra</label>
              <input type="datetime-local" name="closes_at" defaultValue={paraInputLocal(encuesta.closes_at)} className={input} />
            </div>
            <div>
              <label className={label}>Encuesta del mes</label>
              <input type="month" name="featured_month" defaultValue={encuesta.featured_month?.slice(0, 7) ?? ''} className={input} />
            </div>
          </div>
          <div>
            <label className={label}>Visibilidad de resultados</label>
            <select name="results_visibility" defaultValue={encuesta.results_visibility} className={input}>
              <option value="on_close">Al cierre (quien completa, lo ve antes)</option>
              <option value="live">En vivo</option>
              <option value="internal">Solo interno</option>
            </select>
          </div>
          <p className="text-[12px] text-gris">
            Audiencia ({encuesta.audience}) y anonimato ({encuesta.anonymous ? 'anónima' : 'nominal'})
            no se editan: cambiarlos con votos emitidos altera las reglas a mitad de partido.
          </p>
          <button type="submit" disabled={pendiente} className={botonPrimario}>
            Guardar datos
          </button>
          <Aviso zona="datos" />
        </form>
      </section>

      {/* Preguntas */}
      {preguntas.map((p, i) => {
        const sellada = p.respuestas > 0;
        return (
          <section key={p.id} className="rounded-tarjeta border border-linea bg-panel p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[13px] font-bold uppercase tracking-[.08em] text-gris">
                Pregunta {i + 1} · {TIPO[p.kind] ?? p.kind}
              </h2>
              {sellada ? (
                <span className="rounded-full bg-fondo px-2.5 py-1 text-[11px] font-bold text-gris">
                  {p.respuestas} resp.
                </span>
              ) : (
                <button
                  type="button"
                  disabled={pendiente}
                  onClick={() => {
                    if (window.confirm(`¿Eliminar «${p.text}»?`)) {
                      correr(`del-${p.id}`, () => eliminarPreguntaAction(encuesta.id, p.id));
                    }
                  }}
                  className="text-[12.5px] font-bold text-magenta"
                >
                  Eliminar
                </button>
              )}
            </div>

            <form
              action={(fd) => correr(`preg-${p.id}`, () => guardarPreguntaAction(encuesta.id, p.id, fd))}
              className="mt-3 space-y-3"
            >
              <div>
                <label className={label}>Enunciado</label>
                <input name="text" defaultValue={p.text} className={input} />
              </div>
              {(p.kind === 'single' || p.kind === 'multiple') && (
                <div>
                  <label className={label}>Opciones (una por línea)</label>
                  <textarea
                    name="options"
                    defaultValue={(p.options ?? []).join('\n')}
                    rows={3}
                    className={input}
                  />
                </div>
              )}
              {sellada && (
                <p className="text-[12px] text-gris">
                  Con {p.respuestas} voto{p.respuestas === 1 ? '' : 's'} emitido
                  {p.respuestas === 1 ? '' : 's'}: puedes corregir erratas del enunciado y del
                  texto de las opciones (los votos se migran solos al texto nuevo), pero no
                  añadir ni quitar opciones.
                </p>
              )}
              <div>
                <label className={label}>Info ampliada (argumentos, contexto)</label>
                <textarea name="info" defaultValue={p.info ?? ''} rows={2} className={input} />
              </div>
              <div>
                <label className={label}>Propuesta de origen (slug o URL, opcional)</label>
                <input name="proposal_ref" defaultValue={p.proposal_slug ?? ''} className={input} />
              </div>
              <button type="submit" disabled={pendiente} className={botonPrimario}>
                Guardar pregunta
              </button>
              <Aviso zona={`preg-${p.id}`} />
              <Aviso zona={`del-${p.id}`} />
            </form>
          </section>
        );
      })}

      {/* Añadir pregunta */}
      <section className="rounded-tarjeta border-2 border-dashed border-linea bg-panel p-5">
        {!anadiendo ? (
          <button
            type="button"
            onClick={() => setAnadiendo(true)}
            className="w-full rounded-boton bg-accion px-5 py-3 text-[14px] font-bold text-white shadow-boton"
          >
            + Añadir pregunta
          </button>
        ) : (
          <form
            action={(fd) => correr('nueva', () => anadirPreguntaAction(encuesta.id, fd), () => setAnadiendo(false))}
            className="space-y-3"
          >
            <h2 className="text-[13px] font-bold uppercase tracking-[.08em] text-gris">Nueva pregunta</h2>
            <div>
              <label className={label}>Enunciado</label>
              <input name="text" required autoFocus placeholder="Bajar la cuota de autónomos" className={input} />
            </div>
            <div>
              <label className={label}>Tipo</label>
              <select name="kind" defaultValue="single" className={input}>
                {Object.entries(TIPO).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Opciones (una por línea)</label>
              <textarea name="options" rows={3} placeholder={'Sí\nNo'} className={input} />
            </div>
            <div>
              <label className={label}>Info ampliada (opcional)</label>
              <textarea name="info" rows={2} className={input} />
            </div>
            <div>
              <label className={label}>Propuesta de origen (slug o URL, opcional)</label>
              <input name="proposal_ref" className={input} />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={pendiente} className={botonPrimario}>
                {pendiente ? 'Añadiendo…' : 'Añadir'}
              </button>
              <button
                type="button"
                onClick={() => setAnadiendo(false)}
                className="rounded-boton border border-linea bg-white px-5 py-2.5 text-[13.5px] font-bold text-cuerpo"
              >
                Cancelar
              </button>
            </div>
            <Aviso zona="nueva" />
          </form>
        )}
      </section>
    </div>
  );
}

