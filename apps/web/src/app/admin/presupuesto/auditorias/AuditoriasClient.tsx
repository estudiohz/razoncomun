'use client';

import { useState, useTransition } from 'react';
import { cn } from '@/lib/cn';
import Link from 'next/link';
import { ETIQUETA_ESTADO, type EstadoCaso } from '@/lib/vigia/casos';
import { actualizarAuditoria, type EstadoAuditoria } from './actions';
import { abrirCaso } from './casos';

export interface EnvioAuditoria {
  id: string;
  telegram_from: string | null;
  message_text: string | null;
  permalink: string | null;
  video_file_id: string | null;
  status: EstadoAuditoria;
  notes: string | null;
  received_at: string;
  caso: { id: string; status: EstadoCaso; title: string | null } | null;
}

const ETIQUETAS: Record<EstadoAuditoria, { texto: string; clase: string }> = {
  nuevo: { texto: 'Nuevo', clase: 'bg-accion/10 text-accion' },
  en_revision: { texto: 'En revisión', clase: 'bg-naranja/10 text-naranja' },
  procesado: { texto: 'Procesado', clase: 'bg-teal-texto/10 text-teal-texto' },
  descartado: { texto: 'Descartado', clase: 'bg-gris/15 text-gris' },
};

/** Título interno recortado a las primeras palabras. */
const PALABRAS_TITULO = 12;
function recortar(texto: string, max = PALABRAS_TITULO): string {
  const p = texto.trim().split(/\s+/);
  return p.length > max ? `${p.slice(0, max).join(' ')}…` : texto.trim();
}

const esInstagram = (url: string) => /(^|\.)instagram\.com$/i.test(new URL(url).hostname);
function origenDe(url: string | null): 'Instagram' | 'URL' | null {
  if (!url) return null;
  try {
    return esInstagram(url) ? 'Instagram' : 'URL';
  } catch {
    return 'URL';
  }
}

const fecha = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Madrid',
});

function Fila({ envio }: { envio: EnvioAuditoria }) {
  const [estado, setEstado] = useState(envio.status);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, start] = useTransition();

  function guardar(nuevoEstado: EstadoAuditoria) {
    setError(null);
    start(async () => {
      // Las notas se editan dentro del caso; aquí se conservan tal cual.
      const r = await actualizarAuditoria(envio.id, nuevoEstado, envio.notes);
      if ('error' in r && r.error) setError(r.error);
    });
  }

  return (
    <tr className="border-t border-linea align-top">
      <td className="whitespace-nowrap px-3 py-3 text-[12.5px] text-gris">{fecha.format(new Date(envio.received_at))}</td>
      <td className="px-3 py-3 text-[12.5px] text-cuerpo">{envio.telegram_from ?? '—'}</td>
      <td className="max-w-[420px] px-3 py-3 text-[13px] font-semibold text-titular">
        {envio.caso?.title
          ? recortar(envio.caso.title)
          : envio.message_text && envio.message_text !== envio.permalink
            ? <span className="font-normal text-gris">{recortar(envio.message_text)}</span>
            : <span className="font-normal text-gris">Sin título todavía</span>}
        {envio.video_file_id && <p className="mt-1 text-[12px] font-bold text-gris">🎬 Vídeo adjunto en Telegram</p>}
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-[12.5px]">
        {envio.permalink ? (
          <a href={envio.permalink} target="_blank" rel="noopener noreferrer nofollow" className="font-bold text-accion" title={envio.permalink}>
            {origenDe(envio.permalink)}
          </a>
        ) : (
          <span className="text-gris">—</span>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-3">
        {envio.caso ? (
          <Link
            href={`/admin/presupuesto/auditorias/${envio.caso.id}`}
            className="text-[12.5px] font-bold text-accion no-underline hover:underline"
          >
            Ver caso · {ETIQUETA_ESTADO[envio.caso.status]}
          </Link>
        ) : (
          <form action={abrirCaso.bind(null, envio.id)}>
            <button type="submit" className="rounded-boton bg-accion px-3 py-1.5 text-[12.5px] font-bold text-white">
              Abrir caso
            </button>
          </form>
        )}
      </td>
      <td className="px-3 py-3">
        <select
          value={estado}
          disabled={pendiente}
          onChange={(e) => {
            const v = e.target.value as EstadoAuditoria;
            setEstado(v);
            guardar(v);
          }}
          className={cn('rounded-full border-0 px-2.5 py-1 text-[12px] font-bold', ETIQUETAS[estado].clase)}
          aria-label="Estado"
        >
          {(Object.keys(ETIQUETAS) as EstadoAuditoria[]).map((k) => (
            <option key={k} value={k}>
              {ETIQUETAS[k].texto}
            </option>
          ))}
        </select>
        {error && <p className="mt-1 text-[12px] text-magenta">{error}</p>}
      </td>
    </tr>
  );
}

export function AuditoriasClient({ envios }: { envios: EnvioAuditoria[] }) {
  const [filtro, setFiltro] = useState<EstadoAuditoria | 'todos'>('todos');
  const visibles = filtro === 'todos' ? envios : envios.filter((e) => e.status === filtro);

  if (envios.length === 0) {
    return (
      <p className="rounded-tarjeta border border-linea bg-white p-6 text-[13.5px] text-cuerpo">
        Todavía no ha llegado nada. Reenvía un reel al bot de Telegram y pulsa «🔍 Es una auditoría».
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(['todos', ...Object.keys(ETIQUETAS)] as const).map((k) => {
          const n = k === 'todos' ? envios.length : envios.filter((e) => e.status === k).length;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setFiltro(k as EstadoAuditoria | 'todos')}
              className={cn(
                'rounded-full border px-3 py-1 text-[12.5px] font-bold',
                filtro === k ? 'border-titular bg-titular text-white' : 'border-linea bg-white text-cuerpo',
              )}
            >
              {k === 'todos' ? 'Todos' : ETIQUETAS[k as EstadoAuditoria].texto} ({n})
            </button>
          );
        })}
      </div>
      <div className="overflow-x-auto rounded-tarjeta border border-linea bg-white">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[11px] font-bold uppercase tracking-wide text-gris">
              <th className="px-3 py-2.5">Recibido</th>
              <th className="px-3 py-2.5">Enviado por</th>
              <th className="px-3 py-2.5">Título</th>
              <th className="px-3 py-2.5">Origen</th>
              <th className="px-3 py-2.5">Caso</th>
              <th className="px-3 py-2.5">Estado</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((e) => (
              <Fila key={e.id} envio={e} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
