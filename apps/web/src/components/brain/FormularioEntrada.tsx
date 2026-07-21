'use client';

import { useActionState, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { EditorGraficos } from '@/components/brain/EditorGraficos';
import { guardarEntrada, type ResultadoAccion } from '@/lib/brain/wikiAdmin';
import { renderizarMarkdown } from '@/lib/blog/markdown';
import type { AreaTematica, BrainCategoria, BrainEntrada } from '@/lib/brain/tipos';

const botonFmt =
  'rounded-boton border border-linea px-2.5 py-1 text-[12.5px] font-bold text-titular hover:border-titular';

const etiqueta = 'mb-2 block text-[13px] font-bold uppercase tracking-[.08em] text-gris';
const campo = 'mb-6';
const areaTexto =
  'w-full rounded-boton border border-linea bg-white px-4 py-3 text-[15px] text-cuerpo placeholder:text-gris focus:border-titular focus:outline-none focus:ring-2 focus:ring-titular/20';

/** Slug de la categoría "Preguntas frecuentes" (0024_brain_wiki.sql, seed fijo). */
const SLUG_PREGUNTAS_FRECUENTES = 'preguntas-frecuentes';

export function FormularioEntrada({
  entrada,
  categorias,
  areas,
}: {
  entrada: BrainEntrada | null;
  categorias: BrainCategoria[];
  areas: AreaTematica[];
}) {
  const [estado, accion, pendiente] = useActionState<ResultadoAccion | null, FormData>(
    guardarEntrada,
    null,
  );

  const [body, setBody] = useState(entrada?.body ?? '');
  const [categoryId, setCategoryId] = useState(entrada?.category_id ?? categorias[0]?.id ?? '');
  const [previsualizar, setPrevisualizar] = useState(false);

  const html = useMemo(() => (previsualizar ? renderizarMarkdown(body).html : ''), [previsualizar, body]);

  const categoriaSeleccionada = categorias.find((c) => c.id === categoryId);
  const esPreguntaFrecuente = categoriaSeleccionada?.slug === SLUG_PREGUNTAS_FRECUENTES;

  const pendienteDeIndexar = entrada !== null && entrada.indexed_at === null;

  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Barra de formato "visual": el admin no escribe Markdown, pulsa botones y la
  // plataforma inserta la sintaxis por él (determinista, nunca cambia el texto).
  function envolver(pre: string, post: string, porDefecto: string) {
    const ta = bodyRef.current;
    if (!ta) return;
    const ini = ta.selectionStart;
    const fin = ta.selectionEnd;
    const sel = body.slice(ini, fin) || porDefecto;
    setBody(body.slice(0, ini) + pre + sel + post + body.slice(fin));
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ini + pre.length;
      ta.selectionEnd = ini + pre.length + sel.length;
    });
  }
  function prefijoLinea(pre: string) {
    const ta = bodyRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    const inicioLinea = body.lastIndexOf('\n', pos - 1) + 1;
    setBody(body.slice(0, inicioLinea) + pre + body.slice(inicioLinea));
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = pos + pre.length;
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <form id="entrada" action={accion} className="min-w-0">
        {entrada ? <input type="hidden" name="id" value={entrada.id} /> : null}

        {pendienteDeIndexar && (
          <p className="mb-6 rounded-boton border border-naranja/40 bg-naranja/5 px-4 py-3 text-[13.5px] font-semibold text-naranja">
            Esta entrada aún no está en el cerebro; se indexará en la próxima ingesta.
          </p>
        )}

        <div className={campo}>
          <label className={etiqueta} htmlFor="title">
            {esPreguntaFrecuente ? 'Pregunta' : 'Título'}
          </label>
          <Input
            id="title"
            name="title"
            defaultValue={entrada?.title ?? ''}
            placeholder={esPreguntaFrecuente ? '¿Qué cuota de autónomos vais a cobrar?' : ''}
            required
          />
          {esPreguntaFrecuente && (
            <p className="mt-2 text-[12.5px] text-gris">
              En «Preguntas frecuentes» el título ES la pregunta tal y como la haría un ciudadano —
              así el cerebro la encuentra por similitud semántica.
            </p>
          )}
        </div>

        <div className={campo}>
          <div className="mb-2 flex items-center justify-between">
            <label className={`${etiqueta} mb-0`} htmlFor="body">
              Cuerpo
            </label>
            <button
              type="button"
              onClick={() => setPrevisualizar((v) => !v)}
              className="rounded-full border border-linea px-4 py-1.5 text-[13px] font-bold text-titular"
            >
              {previsualizar ? 'Editar' : 'Previsualizar'}
            </button>
          </div>
          {!previsualizar && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              <button type="button" title="Título de sección" className={botonFmt} onClick={() => prefijoLinea('## ')}>
                Título
              </button>
              <button type="button" title="Subtítulo" className={botonFmt} onClick={() => prefijoLinea('### ')}>
                Subtítulo
              </button>
              <button type="button" title="Negrita" className={botonFmt} onClick={() => envolver('**', '**', 'negrita')}>
                <strong>N</strong>
              </button>
              <button type="button" title="Cursiva" className={botonFmt} onClick={() => envolver('*', '*', 'cursiva')}>
                <em>C</em>
              </button>
              <button type="button" title="Lista" className={botonFmt} onClick={() => prefijoLinea('- ')}>
                • Lista
              </button>
              <button
                type="button"
                title="Enlace"
                className={botonFmt}
                onClick={() => envolver('[', '](https://)', 'texto del enlace')}
              >
                Enlace
              </button>
            </div>
          )}
          {previsualizar ? (
            <div
              className="prose-rc min-h-[420px] rounded-boton border border-linea bg-white px-5 py-4"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <textarea
              ref={bodyRef}
              id="body"
              name="body"
              rows={18}
              required
              className={`${areaTexto} text-[15px]`}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          )}
          {previsualizar ? <input type="hidden" name="body" value={body} /> : null}
          <p className="mt-2 text-[12.5px] text-gris">
            Escribe con normalidad. Usa los botones para dar formato (títulos, negrita, listas) —
            no necesitas saber Markdown. «Previsualizar» muestra cómo se verá.
          </p>
        </div>

        <EditorGraficos inicial={entrada?.charts ?? []} />

        {estado?.error ? (
          <p className="mb-4 rounded-boton border border-magenta/40 bg-magenta/5 px-4 py-3 text-[15px] text-magenta">
            {estado.error}
          </p>
        ) : null}
        {estado?.ok ? (
          <p className="mb-4 rounded-boton border border-accion bg-accion/5 px-4 py-3 text-[15px] text-titular">
            Guardado.
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pendiente}
          className="rounded-boton bg-accion px-8 py-3.5 text-[15px] font-bold text-white shadow-boton disabled:opacity-60"
        >
          {pendiente ? 'Guardando…' : 'Guardar'}
        </button>
      </form>

      <aside className="min-w-0">
        <div className="mb-6 rounded-tarjeta border border-linea bg-white p-5">
          <label className={etiqueta} htmlFor="category_id">
            Categoría
          </label>
          <select
            id="category_id"
            name="category_id"
            form="entrada"
            required
            className={areaTexto}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {categorias.length === 0 && <option value="">Sin categorías creadas</option>}
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <p className="mt-3 text-[13px] leading-relaxed text-gris">
            La taxonomía propia del cerebro. Gestiona las categorías desde{' '}
            <a href="/admin/cerebro/categorias" className="font-semibold text-titular underline">
              Categorías
            </a>
            .
          </p>
        </div>

        <div className="mb-6 rounded-tarjeta border border-linea bg-white p-5">
          <label className={etiqueta} htmlFor="area_id">
            Área temática
          </label>
          <select
            id="area_id"
            name="area_id"
            form="entrada"
            className={areaTexto}
            defaultValue={entrada?.area_id ?? ''}
          >
            <option value="">Sin área</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <p className="mt-3 text-[13px] leading-relaxed text-gris">
            Opcional: el mismo catálogo de departamentos del blog (Vivienda, Sanidad, Autónomos…).
            No todo documento tiene departamento — p. ej. Estatutos.
          </p>
        </div>

        <div className="rounded-tarjeta border border-linea bg-white p-5">
          <label className={etiqueta} htmlFor="visibility">
            Visibilidad
          </label>
          <select
            id="visibility"
            name="visibility"
            form="entrada"
            className={areaTexto}
            defaultValue={entrada?.visibility ?? 'internal'}
          >
            <option value="internal">Interno</option>
            <option value="public">Público</option>
          </select>
          <p className="mt-3 text-[13px] leading-relaxed text-gris">
            <strong className="text-titular">Público</strong> = el chat ciudadano puede usarlo.{' '}
            <strong className="text-titular">Interno</strong> = solo conocimiento interno del equipo.
          </p>
        </div>
      </aside>
    </div>
  );
}
