'use client';

import { useActionState, useMemo, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { guardarArticulo, subirPortada, type ResultadoAccion } from '@/lib/blog/admin';
import { renderizarMarkdown } from '@/lib/blog/markdown';
import type { Articulo, Categoria } from '@/lib/blog/tipos';

const etiqueta = 'mb-2 block text-[13px] font-bold uppercase tracking-[.08em] text-gris';
const campo = 'mb-6';
const areaTexto =
  'w-full rounded-boton border border-linea bg-white px-4 py-3 text-[15px] text-cuerpo placeholder:text-gris focus:border-titular focus:outline-none focus:ring-2 focus:ring-titular/20';

export function FormularioArticulo({
  articulo,
  categorias,
}: {
  articulo: Articulo | null;
  categorias: Categoria[];
}) {
  const [estado, accion, pendiente] = useActionState<ResultadoAccion | null, FormData>(
    guardarArticulo,
    null,
  );
  const [subida, accionSubida, subiendo] = useActionState<
    { url?: string; error?: string } | null,
    FormData
  >(subirPortada, null);

  const [body, setBody] = useState(articulo?.body ?? '');
  const [portada, setPortada] = useState(articulo?.cover_image ?? '');
  const [previsualizar, setPrevisualizar] = useState(false);

  const urlPortada = subida?.url ?? portada;
  const html = useMemo(
    () => (previsualizar ? renderizarMarkdown(body).html : ''),
    [previsualizar, body],
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <form id="articulo" action={accion} className="min-w-0">
        {articulo ? <input type="hidden" name="id" value={articulo.id} /> : null}
        <input type="hidden" name="cover_image" value={urlPortada} />

        <div className={campo}>
          <label className={etiqueta} htmlFor="title">
            Título
          </label>
          <Input id="title" name="title" defaultValue={articulo?.title ?? ''} required />
        </div>

        <div className={campo}>
          <label className={etiqueta} htmlFor="slug">
            Slug (se genera del título si se deja vacío)
          </label>
          <Input id="slug" name="slug" defaultValue={articulo?.slug ?? ''} placeholder="mi-articulo" />
        </div>

        <div className={campo}>
          <label className={etiqueta} htmlFor="excerpt">
            Entradilla
          </label>
          <textarea id="excerpt" name="excerpt" rows={2} className={areaTexto} defaultValue={articulo?.excerpt ?? ''} />
        </div>

        <div className={campo}>
          <div className="mb-2 flex items-center justify-between">
            <label className={`${etiqueta} mb-0`} htmlFor="body">
              Cuerpo (markdown)
            </label>
            <button
              type="button"
              onClick={() => setPrevisualizar((v) => !v)}
              className="rounded-full border border-linea px-4 py-1.5 text-[13px] font-bold text-titular"
            >
              {previsualizar ? 'Editar' : 'Previsualizar'}
            </button>
          </div>
          {previsualizar ? (
            <div
              className="prose-rc min-h-[420px] rounded-boton border border-linea bg-white px-5 py-4"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <textarea
              id="body"
              name="body"
              rows={20}
              required
              className={`${areaTexto} font-mono text-[14px]`}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          )}
          {previsualizar ? <input type="hidden" name="body" value={body} /> : null}
        </div>

        <div className={campo}>
          <label className={etiqueta} htmlFor="source_urls">
            Fuentes (una URL por línea) · obligatorias para publicar
          </label>
          <textarea
            id="source_urls"
            name="source_urls"
            rows={4}
            className={areaTexto}
            defaultValue={(articulo?.source_urls ?? []).join('\n')}
          />
        </div>

        <details className="mb-6 rounded-tarjeta border border-linea bg-white p-5">
          <summary className="cursor-pointer text-[15px] font-bold text-titular">SEO</summary>
          <div className="mt-5">
            <div className={campo}>
              <label className={etiqueta} htmlFor="seo_title">
                Título SEO
              </label>
              <Input id="seo_title" name="seo_title" defaultValue={articulo?.seo_title ?? ''} />
            </div>
            <div className="mb-0">
              <label className={etiqueta} htmlFor="seo_desc">
                Descripción SEO
              </label>
              <textarea id="seo_desc" name="seo_desc" rows={2} className={areaTexto} defaultValue={articulo?.seo_desc ?? ''} />
            </div>
          </div>
        </details>

        {estado?.error ? (
          <p className="mb-4 rounded-boton border border-[#C3369E] bg-[#C3369E]/5 px-4 py-3 text-[15px] text-[#C3369E]">
            {estado.error}
          </p>
        ) : null}
        {estado?.ok ? (
          <p className="mb-4 rounded-boton border border-accion bg-accion/5 px-4 py-3 text-[15px] text-titular">
            Guardado. {estado.aviso ?? ''}
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
          <label className={etiqueta} htmlFor="status">
            Estado
          </label>
          <select
            id="status"
            name="status"
            form="articulo"
            defaultValue={articulo?.status ?? 'draft'}
            className={areaTexto}
          >
            <option value="draft">Borrador</option>
            <option value="published">Publicado</option>
          </select>
          <p className="mt-3 text-[13px] leading-relaxed text-gris">
            Publicar exige al menos una fuente: el sello de trazabilidad es obligatorio.
          </p>
        </div>

        <div className="mb-6 rounded-tarjeta border border-linea bg-white p-5">
          <label className={etiqueta} htmlFor="category_id">
            Categoría
          </label>
          <select
            id="category_id"
            name="category_id"
            form="articulo"
            className={areaTexto}
            defaultValue={articulo?.category_id ?? ''}
          >
            <option value="">Sin categoría</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <label className={`${etiqueta} mt-5`} htmlFor="source_type">
            Sección
          </label>
          <select
            id="source_type"
            name="source_type"
            form="articulo"
            className={areaTexto}
            defaultValue={articulo?.source_type ?? 'editorial'}
          >
            <option value="editorial">Blog</option>
            <option value="observatorio">Observatorio</option>
          </select>
        </div>

        <div className="rounded-tarjeta border border-linea bg-white p-5">
          <p className={etiqueta}>Portada</p>
          {urlPortada ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={urlPortada} alt="Portada actual" className="mb-4 w-full rounded-boton" />
          ) : null}
          <input
            type="url"
            className={areaTexto}
            placeholder="URL de la portada"
            value={urlPortada}
            onChange={(e) => setPortada(e.target.value)}
          />
          <p className="mt-3 text-[13px] text-gris">o sube un archivo (JPG/PNG/WebP/AVIF, máx. 5 MB):</p>
          <input type="file" name="archivo" accept="image/*" form="subida" className="mt-2 text-[13px]" />
          <button
            type="submit"
            form="subida"
            disabled={subiendo}
            className="mt-3 w-full rounded-boton border border-linea px-4 py-2.5 text-[14px] font-bold text-titular disabled:opacity-60"
          >
            {subiendo ? 'Subiendo…' : 'Subir portada'}
          </button>
          {subida?.error ? <p className="mt-3 text-[13px] text-[#C3369E]">{subida.error}</p> : null}
        </div>
      </aside>

      {/* Formulario aparte para la subida: no debe enviar el artículo entero. */}
      <form id="subida" action={accionSubida} className="hidden" />
    </div>
  );
}
