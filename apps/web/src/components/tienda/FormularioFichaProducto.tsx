'use client';

import Image from 'next/image';
import { useActionState, useState, useTransition } from 'react';
import { EditorRico } from '@/components/blog/EditorRico';
import { Input } from '@/components/ui/Input';
import { guardarFichaProducto, type ResultadoFicha } from '@/app/admin/tienda/actions';
import { subirMedia } from '@/lib/blog/admin';
import type { FichaProducto } from '@/lib/tienda/fichas';

const etiqueta = 'mb-1 block text-[12px] font-bold uppercase tracking-[.06em] text-gris';
const MAX_FOTOS = 8;

/**
 * Editor de la ficha de un producto. El catálogo (nombre, precio, variantes,
 * mockups) NO se toca aquí: lo manda Printful (D-T1). Esto es solo el texto
 * que Printful no tiene.
 *
 * La subida de fotos reutiliza `subirMedia` del blog en vez de crear un bucket
 * propio: mismo bucket, mismas políticas, mismos tipos admitidos. Se llama de
 * forma imperativa y no con un `<form action>` porque este editor ya vive
 * dentro de un formulario y HTML no admite formularios anidados.
 */
export function FormularioFichaProducto({
  productoId,
  nombre,
  ficha,
}: {
  productoId: number;
  nombre: string;
  ficha: FichaProducto;
}) {
  const [estado, accion, pendiente] = useActionState<ResultadoFicha | null, FormData>(
    guardarFichaProducto,
    null,
  );
  const [descripcion, setDescripcion] = useState(ficha.description_html);
  const [tallas, setTallas] = useState(ficha.size_guide_html);
  const [fotos, setFotos] = useState<string[]>(ficha.extra_images);
  const [subiendo, empezarSubida] = useTransition();
  const [errorFoto, setErrorFoto] = useState<string | null>(null);

  function alElegirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir el mismo fichero
    if (!archivo) return;
    setErrorFoto(null);
    const fd = new FormData();
    fd.set('archivo', archivo);
    empezarSubida(async () => {
      const r = await subirMedia(null, fd);
      if (r.error || !r.url) return setErrorFoto(r.error ?? 'No se ha podido subir la foto.');
      setFotos((f) => (f.includes(r.url!) ? f : [...f, r.url!].slice(0, MAX_FOTOS)));
    });
  }

  return (
    <form action={accion} className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0">
        <input type="hidden" name="printful_product_id" value={productoId} />

        <label className={etiqueta}>Descripción</label>
        <p className="mb-2 text-[12.5px] text-gris">
          Qué es y por qué merece la pena: material, medidas, capacidad, gramaje. Es lo que
          responde a &ldquo;¿esto qué es exactamente?&rdquo; antes de comprar.
        </p>
        <EditorRico valor={descripcion} onChange={setDescripcion} />
        <input type="hidden" name="description_html" value={descripcion} />

        <label className={`${etiqueta} mt-8`}>Guía de tallas</label>
        <p className="mb-2 text-[12.5px] text-gris">
          Solo para ropa. Si lo dejas vacío, el desplegable no aparece en la ficha.
        </p>
        <EditorRico valor={tallas} onChange={setTallas} />
        <input type="hidden" name="size_guide_html" value={tallas} />

        {estado?.error ? (
          <p className="mt-6 rounded-boton border border-magenta/40 bg-magenta/5 px-4 py-3 text-[15px] text-magenta">
            {estado.error}
          </p>
        ) : null}
        {estado?.ok ? (
          <p className="mt-6 rounded-boton border border-accion bg-accion/5 px-4 py-3 text-[15px] text-titular">
            Guardado. La ficha pública ya está actualizada.
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pendiente}
          className="mt-6 rounded-boton bg-accion px-8 py-3.5 text-[15px] font-bold text-white shadow-boton disabled:opacity-60"
        >
          {pendiente ? 'Guardando…' : 'Guardar ficha'}
        </button>
      </div>

      <aside className="min-w-0 space-y-6">
        <div className="rounded-tarjeta border border-linea bg-white p-5">
          <p className={etiqueta}>Producto</p>
          <p className="text-[14px] font-bold text-titular">{nombre}</p>
          <p className="mt-1 font-mono text-[12px] text-gris">Printful #{productoId}</p>
          <a
            href={`/tienda/${productoId}`}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-[13px] font-bold text-titular"
          >
            Ver ficha pública ↗
          </a>
        </div>

        <div className="rounded-tarjeta border border-linea bg-white p-5">
          <label className={etiqueta} htmlFor="delivery_note">
            Plazo de entrega
          </label>
          <Input
            id="delivery_note"
            name="delivery_note"
            defaultValue={ficha.delivery_note}
            maxLength={120}
            placeholder="3-6 días laborables"
          />
          <p className="mt-2 text-[12px] text-gris">
            Se lee en la ficha como &ldquo;Se fabrica bajo pedido: 3-6 días laborables&rdquo;. Vacío
            = no se dice ningún plazo.
          </p>
        </div>

        <div className="rounded-tarjeta border border-linea bg-white p-5">
          <p className={etiqueta}>Fotos de uso</p>
          <p className="mb-3 text-[12px] text-gris">
            Se añaden a la galería DESPUÉS de los mockups de Printful. Máximo {MAX_FOTOS}.
          </p>

          {fotos.length > 0 && (
            <ul className="mb-3 grid grid-cols-3 gap-2">
              {fotos.map((url) => (
                <li key={url} className="relative">
                  <span className="relative block aspect-square overflow-hidden rounded-[10px] bg-fondo">
                    <Image src={url} alt="" fill sizes="90px" className="object-cover" />
                  </span>
                  <button
                    type="button"
                    onClick={() => setFotos((f) => f.filter((u) => u !== url))}
                    aria-label="Quitar esta foto"
                    className="absolute -right-1.5 -top-1.5 h-6 w-6 rounded-full border border-linea bg-white text-[13px] font-bold text-magenta shadow-sm"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          <input
            type="file"
            accept="image/*"
            onChange={alElegirFoto}
            disabled={subiendo || fotos.length >= MAX_FOTOS}
            className="block w-full text-[12.5px] text-cuerpo file:mr-3 file:rounded-boton file:border-0 file:bg-fondo file:px-3 file:py-2 file:text-[12.5px] file:font-bold file:text-titular"
          />
          {subiendo && <p className="mt-2 text-[12px] text-gris">Subiendo…</p>}
          {errorFoto && <p className="mt-2 text-[12px] text-magenta">{errorFoto}</p>}

          {/* Las URLs viajan en un campo oculto, una por línea: el `<input
              type=file>` de arriba solo sube, no forma parte del guardado. */}
          <input type="hidden" name="extra_images" value={fotos.join('\n')} />
        </div>
      </aside>
    </form>
  );
}
