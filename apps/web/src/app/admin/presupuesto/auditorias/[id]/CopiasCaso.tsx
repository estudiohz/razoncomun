'use client';

import { useState, useTransition } from 'react';
import { copiarOrigenCaso, enlaceCopia } from '../casos';

export interface Copia {
  id: string;
  tipo: 'origen' | 'prueba';
  metodo: string;
  url: string;
  sha256: string;
  bytes: number | null;
  capturada_at: string;
  notas: string | null;
}

const fecha = new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Madrid' });
const NOMBRE: Record<string, string> = {
  html: 'Página',
  json: 'Registro oficial',
  pdf: 'PDF',
  video: 'Vídeo',
  imagen: 'Imagen',
  otro: 'Archivo',
};

function tamano(b: number | null) {
  if (b == null) return '';
  return b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
}

/**
 * Copias de respaldo del caso (0074): el origen y las pruebas oficiales tal
 * como estaban el día que se comprobaron, con su huella sha256. Viven en un
 * bucket privado; se descargan con un enlace temporal.
 */
export function CopiasCaso({ alertId, copias, esRedSocial }: { alertId: string; copias: Copia[]; esRedSocial: boolean }) {
  const [pendiente, start] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);
  const hayOrigen = copias.some((c) => c.tipo === 'origen');

  const descargar = (id: string) =>
    start(async () => {
      const r = await enlaceCopia(id);
      if ('url' in r) window.open(r.url, '_blank', 'noopener');
      else setAviso(r.error);
    });

  return (
    <section className="space-y-4 rounded-tarjeta border border-linea bg-white p-5">
      <div>
        <h2 className="text-[15px] font-extrabold text-titular">Copias de respaldo</h2>
        <p className="mt-1 text-[12.5px] text-gris">
          Por si el origen o la fuente cambian o desaparecen: lo que decían el día que se comprobó, con huella sha256.
          Privado, no se publica.
        </p>
      </div>
      {aviso && <p className="text-[13px] text-magenta">{aviso}</p>}

      {!hayOrigen && (
        <p className="rounded-boton border border-naranja/40 bg-naranja/5 p-3 text-[13px] text-cuerpo">
          {esRedSocial
            ? 'Todavía no hay copia del reel. El bot guarda el vídeo al recibirlo; los casos anteriores a este cambio no la tienen.'
            : 'Todavía no hay copia del origen.'}{' '}
          {!esRedSocial && (
            <button
              type="button"
              disabled={pendiente}
              className="font-bold text-accion underline"
              onClick={() =>
                start(async () => {
                  const r = await copiarOrigenCaso(alertId);
                  setAviso('error' in r ? r.error : null);
                })
              }
            >
              Copiar ahora
            </button>
          )}
        </p>
      )}

      {copias.length > 0 && (
        <ul className="space-y-2">
          {copias.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-start justify-between gap-2 rounded-boton border border-linea p-3 text-[13px]"
            >
              <div className="min-w-0 text-cuerpo">
                <p className="font-bold text-titular">
                  {c.tipo === 'origen' ? 'Origen' : 'Prueba'} · {NOMBRE[c.metodo] ?? c.metodo} · {tamano(c.bytes)}
                </p>
                <p className="break-all text-gris">{c.url}</p>
                <p className="text-[12px] text-gris">
                  {fecha.format(new Date(c.capturada_at))} · sha256 {c.sha256.slice(0, 16)}…{c.notas ? ` · ${c.notas}` : ''}
                </p>
              </div>
              <button
                type="button"
                disabled={pendiente}
                onClick={() => descargar(c.id)}
                className="rounded-boton border border-linea bg-white px-4 py-2 text-[13px] font-bold text-titular hover:border-titular disabled:opacity-50"
              >
                Descargar
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
