'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { crearEncuestaAction } from '@/app/admin/participacion/encuestas/actions';
import type { TipoPregunta } from '@/lib/participacion/types';

interface PreguntaBorrador {
  kind: TipoPregunta;
  text: string;
  opcionesTexto: string; // una por línea, solo aplica a single/multiple
}

const ETIQUETA_TIPO: Record<TipoPregunta, string> = {
  single: 'Respuesta única',
  multiple: 'Respuesta múltiple',
  scale: 'Escala (1-5)',
  text: 'Texto libre',
};

/** Constructor multi-pregunta del admin (single/multiple/scale/texto), con audiencia y cierre. */
export function ConstructorEncuesta({ territorios }: { territorios: { id: number; name: string }[] }) {
  const [preguntas, setPreguntas] = useState<PreguntaBorrador[]>([
    { kind: 'single', text: '', opcionesTexto: '' },
  ]);

  function anadirPregunta() {
    setPreguntas((prev) => [...prev, { kind: 'single', text: '', opcionesTexto: '' }]);
  }

  function quitarPregunta(i: number) {
    setPreguntas((prev) => prev.filter((_, idx) => idx !== i));
  }

  function actualizarPregunta(i: number, cambio: Partial<PreguntaBorrador>) {
    setPreguntas((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...cambio } : p)));
  }

  function alEnviar(formData: FormData) {
    const preguntasJson = preguntas
      .filter((p) => p.text.trim())
      .map((p) => ({
        kind: p.kind,
        text: p.text.trim(),
        options:
          p.kind === 'single' || p.kind === 'multiple'
            ? p.opcionesTexto.split('\n').map((o) => o.trim()).filter(Boolean)
            : null,
      }));
    formData.set('preguntas_json', JSON.stringify(preguntasJson));
    return crearEncuestaAction(formData);
  }

  return (
    <form action={alEnviar} className="space-y-6 rounded-tarjeta border border-linea bg-panel p-6">
      <Campo etiqueta="Título">
        <input name="title" required minLength={6} className="w-full rounded-boton border border-linea px-4 py-2.5 text-[15px]" />
      </Campo>

      <Campo etiqueta="Descripción (opcional)">
        <textarea name="description" rows={2} className="w-full rounded-boton border border-linea px-4 py-2.5 text-[14px]" />
      </Campo>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Audiencia">
          <select name="audience" required className="w-full rounded-boton border border-linea px-4 py-2.5 text-[14px]">
            <option value="public">Público (cualquiera)</option>
            <option value="registered">Registrados</option>
            <option value="member">Afiliados</option>
          </select>
        </Campo>
        <Campo etiqueta="Territorio (opcional, filtra por comunidad)">
          <select name="territory_id" className="w-full rounded-boton border border-linea px-4 py-2.5 text-[14px]">
            <option value="">Todo el territorio</option>
            {territorios.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Visibilidad de resultados">
          <select name="results_visibility" required className="w-full rounded-boton border border-linea px-4 py-2.5 text-[14px]">
            <option value="on_close">Al cierre</option>
            <option value="live">En vivo</option>
            <option value="internal">Solo interno (admin/coordinador)</option>
          </select>
        </Campo>
        <label className="flex items-center gap-2.5 self-end pb-2.5 text-[13.5px] text-cuerpo">
          <input type="checkbox" name="anonymous" defaultChecked className="h-4 w-4 rounded border-linea text-accion" />
          Encuesta anónima (sin censo)
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Abre">
          <input type="datetime-local" name="opens_at" required className="w-full rounded-boton border border-linea px-4 py-2.5 text-[14px]" />
        </Campo>
        <Campo etiqueta="Cierra">
          <input type="datetime-local" name="closes_at" required className="w-full rounded-boton border border-linea px-4 py-2.5 text-[14px]" />
        </Campo>
      </div>

      <div>
        <h3 className="text-[14px] font-bold text-titular">Preguntas</h3>
        <div className="mt-3 space-y-4">
          {preguntas.map((p, i) => (
            <div key={i} className="rounded-boton border border-dashed border-linea p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 space-y-3">
                  <input
                    value={p.text}
                    onChange={(e) => actualizarPregunta(i, { text: e.target.value })}
                    placeholder={`Pregunta ${i + 1}`}
                    className="w-full rounded-boton border border-linea px-4 py-2 text-[14px]"
                  />
                  <select
                    value={p.kind}
                    onChange={(e) => actualizarPregunta(i, { kind: e.target.value as TipoPregunta })}
                    className="rounded-boton border border-linea px-3 py-1.5 text-[13px]"
                  >
                    {(Object.keys(ETIQUETA_TIPO) as TipoPregunta[]).map((k) => (
                      <option key={k} value={k}>
                        {ETIQUETA_TIPO[k]}
                      </option>
                    ))}
                  </select>
                  {(p.kind === 'single' || p.kind === 'multiple') && (
                    <textarea
                      value={p.opcionesTexto}
                      onChange={(e) => actualizarPregunta(i, { opcionesTexto: e.target.value })}
                      placeholder={'Una opción por línea'}
                      rows={3}
                      className="w-full rounded-boton border border-linea px-4 py-2 text-[13.5px]"
                    />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => quitarPregunta(i)}
                  className="text-[13px] font-bold text-cat-sanidad"
                >
                  Quitar
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={anadirPregunta}
          className="mt-3 rounded-boton border border-linea bg-white px-4 py-2 text-[13px] font-bold text-titular hover:border-titular"
        >
          + Añadir pregunta
        </button>
      </div>

      <BotonEnviar />
    </form>
  );
}

function BotonEnviar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-boton bg-accion px-6 py-3 text-[14px] font-bold text-white shadow-boton disabled:opacity-60"
    >
      {pending ? 'Publicando…' : 'Publicar encuesta'}
    </button>
  );
}

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[13.5px] font-semibold">{etiqueta}</label>
      {children}
    </div>
  );
}
