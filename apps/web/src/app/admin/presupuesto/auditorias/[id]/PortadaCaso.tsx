'use client';

import { useState, useTransition } from 'react';
import { cn } from '@/lib/cn';
import { quitarPortadaCaso, subirPortadaCaso } from '../casos';

const tarjeta = 'space-y-4 rounded-tarjeta border border-linea bg-white p-5';
const botonSecundario =
  'rounded-boton border border-linea bg-white px-4 py-2.5 text-[13px] font-bold text-titular hover:border-titular disabled:opacity-50';

const TEXTOS = {
  cover_image: {
    titulo: 'Foto de cabecera',
    ayuda: 'Se muestra arriba de la ficha pública, como en una noticia (formato panorámico 21:9).',
    aspecto: 'aspect-[21/9] max-w-[560px]',
  },
  reel_frame: {
    titulo: 'Fotograma del reel',
    ayuda: 'Encabeza el lateral de la ficha pública, con el enlace al reel y a la cuenta. Haz una captura del primer fotograma (vertical 9:16).',
    aspecto: 'aspect-[9/16] max-w-[180px]',
  },
} as const;

/**
 * Imágenes de la ficha pública (0080): foto de cabecera y fotograma del reel.
 * Se pueden cambiar en cualquier estado: son decorativas y no abren versión nueva.
 */
export function PortadaCaso({
  alertId,
  imagen,
  campo = 'cover_image',
}: {
  alertId: string;
  imagen: string | null;
  campo?: keyof typeof TEXTOS;
}) {
  const textos = TEXTOS[campo];
  const [pendiente, start] = useTransition();
  const [url, setUrl] = useState(imagen);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  return (
    <section className={tarjeta}>
      <div>
        <h2 className="text-[15px] font-extrabold text-titular">{textos.titulo}</h2>
        <p className="mt-1 text-[12.5px] text-gris">{textos.ayuda} JPG, PNG, WebP o AVIF, hasta 5 MB.</p>
      </div>
      {aviso && (
        <p
          role="status"
          className={cn(
            'rounded-boton border p-3 text-[13.5px]',
            aviso.tipo === 'ok' ? 'border-teal-texto/40 bg-teal-texto/5 text-teal-texto' : 'border-magenta/40 bg-magenta/5 text-magenta',
          )}
        >
          {aviso.texto}
        </p>
      )}
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className={`${textos.aspecto} w-full rounded-boton border border-linea object-cover`} />
      )}
      <form
        className="flex flex-wrap items-center gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const datos = new FormData(e.currentTarget);
          setAviso(null);
          start(async () => {
            const r = await subirPortadaCaso(alertId, datos, campo);
            if ('error' in r) setAviso({ tipo: 'error', texto: r.error });
            else {
              setUrl(r.url ?? null);
              setAviso({ tipo: 'ok', texto: 'Foto guardada.' });
            }
          });
        }}
      >
        <input type="file" name="archivo" accept="image/jpeg,image/png,image/webp,image/avif" className="text-[13px]" required />
        <button type="submit" disabled={pendiente} className={botonSecundario}>
          {pendiente ? 'Subiendo…' : url ? 'Cambiar foto' : 'Subir foto'}
        </button>
        {url && (
          <button
            type="button"
            disabled={pendiente}
            className={botonSecundario}
            onClick={() =>
              start(async () => {
                const r = await quitarPortadaCaso(alertId, campo);
                if ('error' in r) setAviso({ tipo: 'error', texto: r.error });
                else {
                  setUrl(null);
                  setAviso({ tipo: 'ok', texto: 'Foto quitada.' });
                }
              })
            }
          >
            Quitar
          </button>
        )}
      </form>
    </section>
  );
}
