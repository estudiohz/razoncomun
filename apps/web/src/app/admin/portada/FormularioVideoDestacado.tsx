'use client';

import { useActionState, useState } from 'react';
import { guardarVideoDestacado, subirCaratulaVideo, type ResultadoCaratula, type ResultadoPortada } from './actions';

const etiqueta = 'mb-2 block text-[13px] font-bold uppercase tracking-[.08em] text-gris';
const areaTexto =
  'w-full rounded-boton border border-linea bg-white px-4 py-2.5 text-[14px] outline-none focus:border-titular';

/**
 * Dos formularios independientes en la misma pantalla, MISMO patrón que la
 * portada del blog (`FormularioArticulo.tsx`): la URL se guarda al vuelo, la
 * subida de la imagen es una acción aparte con su propio `useActionState`
 * para no bloquear una con la otra. El de subida vive oculto con
 * `id="subida-caratula"` y el input de fichero le apunta con `form=`.
 */
export function FormularioVideoDestacado({
  urlInicial,
  caratulaInicial,
}: {
  urlInicial: string;
  caratulaInicial: string;
}) {
  const [estado, accion, guardando] = useActionState<ResultadoPortada | null, FormData>(
    guardarVideoDestacado,
    null,
  );
  const [subida, accionSubida, subiendo] = useActionState<ResultadoCaratula | null, FormData>(
    subirCaratulaVideo,
    null,
  );

  const [url, setUrl] = useState(urlInicial);
  const caratula = subida?.url ?? caratulaInicial;

  return (
    <div className="space-y-6">
      <form action={accion} className="space-y-2">
        <label className={etiqueta} htmlFor="url">
          URL del vídeo de YouTube
        </label>
        <input
          id="url"
          name="url"
          type="url"
          className={areaTexto}
          placeholder="https://www.youtube.com/watch?v=..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <p className="text-[13px] text-gris">
          Pega el enlace tal cual sale del navegador o del botón "Compartir" de YouTube. Déjalo
          vacío y guarda para quitar el vídeo destacado (vuelven los tres artículos de siempre).
        </p>
        <button
          type="submit"
          disabled={guardando}
          className="rounded-boton bg-accion px-5 py-2.5 text-[14px] font-bold text-white disabled:opacity-60"
        >
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
        {estado?.error ? <p className="text-[13px] text-[#C3369E]">{estado.error}</p> : null}
        {estado?.ok ? <p className="text-[13px] text-accion">Guardado.</p> : null}
      </form>

      <div className="border-t border-linea pt-6">
        <p className={etiqueta}>Carátula</p>
        {caratula ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={caratula} alt="Carátula actual" className="mb-4 aspect-video w-full rounded-boton object-cover" />
        ) : (
          <p className="mb-4 text-[13px] text-gris">Sin carátula todavía.</p>
        )}
        <input
          type="file"
          name="archivo"
          accept="image/*"
          form="subida-caratula"
          className="text-[13px]"
        />
        <p className="mt-2 text-[13px] text-gris">JPG, PNG, WebP o AVIF, máx. 5 MB. Formato horizontal (16:9).</p>
        <button
          type="submit"
          form="subida-caratula"
          disabled={subiendo}
          className="mt-3 rounded-boton border border-linea px-4 py-2.5 text-[14px] font-bold text-titular disabled:opacity-60"
        >
          {subiendo ? 'Subiendo…' : 'Subir carátula'}
        </button>
        {subida?.error ? <p className="mt-2 text-[13px] text-[#C3369E]">{subida.error}</p> : null}
      </div>

      {/* Formulario aparte para la subida: no debe disparar el guardado de la URL. */}
      <form id="subida-caratula" action={accionSubida} className="hidden" />
    </div>
  );
}
