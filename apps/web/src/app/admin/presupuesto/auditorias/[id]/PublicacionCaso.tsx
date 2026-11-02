'use client';

import { useState, useTransition } from 'react';
import { cn } from '@/lib/cn';
import { asignarCategoriaCaso, despublicarCaso, publicarCaso, rectificarCaso, resolverRectificacion } from '../casos';

export interface Rectificacion {
  id: string;
  requester_name: string;
  requester_email: string;
  requester_role: string;
  request_text: string;
  received_at: string;
  resolved_at: string | null;
  resolution: string | null;
  public_note: string | null;
}

const tarjeta = 'space-y-4 rounded-tarjeta border border-linea bg-white p-5';
const control = 'w-full rounded-boton border border-linea bg-white px-3 py-2.5 text-[14px]';
const botonPrincipal = 'rounded-boton bg-accion px-5 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-50';
const botonSecundario =
  'rounded-boton border border-linea bg-white px-4 py-2.5 text-[13px] font-bold text-titular hover:border-titular disabled:opacity-50';
const fecha = new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Madrid' });

/**
 * Publicación del caso (F2): publicar o programar, rectificar con versión
 * nueva, retirar (solo admin) y responder solicitudes de rectificación (M7).
 */
export function PublicacionCaso({
  alertId,
  status,
  slug,
  publishedAt,
  replicaPedida,
  rectificadoAt,
  esAdmin,
  rectificaciones,
  categorias,
  categoryId,
}: {
  alertId: string;
  status: string;
  slug: string | null;
  publishedAt: string | null;
  replicaPedida: boolean;
  rectificadoAt: string | null;
  esAdmin: boolean;
  rectificaciones: Rectificacion[];
  categorias: { id: number; name: string }[];
  categoryId: number | null;
}) {
  const [pendiente, start] = useTransition();
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [programar, setProgramar] = useState('');
  const [sinReplica, setSinReplica] = useState(false);
  const [nota, setNota] = useState('');
  const [motivo, setMotivo] = useState('');
  const [categoria, setCategoria] = useState(categoryId == null ? '' : String(categoryId));

  const lanzar = (accion: () => Promise<{ ok: true } | { error: string }>, exito: string) => {
    setAviso(null);
    start(async () => {
      const r = await accion();
      setAviso('error' in r ? { tipo: 'error', texto: r.error } : { tipo: 'ok', texto: exito });
    });
  };

  if (status !== 'verified' && status !== 'published') return null;
  const programado = status === 'published' && publishedAt && new Date(publishedAt) > new Date();
  const pendientes = rectificaciones.filter((r) => !r.resolved_at);

  return (
    <section className={tarjeta}>
      <div>
        <h2 className="text-[15px] font-extrabold text-titular">Publicación</h2>
        <p className="mt-1 text-[12.5px] text-gris">
          La ficha pública muestra el origen, los hechos y la valoración por separado, la prueba oficial con su copia sellada, la
          firma del auditor, la réplica y el historial de versiones.
        </p>
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

      <div>
        <label className="mb-1 block text-[12px] font-bold text-gris" htmlFor="categoria-blog">
          Categoría en el Observatorio (gráfico «Lo más señalado» y filtros)
        </label>
        <select
          id="categoria-blog"
          value={categoria}
          disabled={pendiente}
          onChange={(e) => {
            const v = e.target.value;
            setCategoria(v);
            lanzar(() => asignarCategoriaCaso(alertId, v ? Number(v) : null), 'Categoría guardada.');
          }}
          className={control}
        >
          <option value="">Sin categoría</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {status === 'verified' && (
        <div className="space-y-3">
          <div className="grid gap-3 min-[720px]:grid-cols-[1fr_auto] min-[720px]:items-end">
            <div>
              <label className="mb-1 block text-[12px] font-bold text-gris" htmlFor="programar">
                Publicar el (vacío = ahora)
              </label>
              <input
                id="programar"
                type="datetime-local"
                value={programar}
                onChange={(e) => setProgramar(e.target.value)}
                className={control}
              />
            </div>
          </div>
          {!replicaPedida && (
            <label className="flex items-start gap-2 text-[13.5px] text-naranja">
              <input type="checkbox" className="mt-1" checked={sinReplica} onChange={(e) => setSinReplica(e.target.checked)} />
              No se pidió réplica (no fue posible o no era necesaria). Confirmo que se publica sin ella.
            </label>
          )}
          <button
            type="button"
            disabled={pendiente || (!replicaPedida && !sinReplica)}
            className={botonPrincipal}
            onClick={() =>
              lanzar(
                () => publicarCaso(alertId, programar ? new Date(programar).toISOString() : null, sinReplica),
                programar ? 'Publicación programada.' : 'Caso publicado.',
              )
            }
          >
            {programar ? 'Programar publicación' : 'Publicar ahora'}
          </button>
        </div>
      )}

      {status === 'published' && (
        <div className="space-y-4">
          <p className="text-[13.5px] text-cuerpo">
            {programado ? 'Programado para el ' : 'Publicado el '}
            {publishedAt && fecha.format(new Date(publishedAt))}
            {rectificadoAt && ` · rectificado el ${fecha.format(new Date(rectificadoAt))}`}
            {slug && (
              <>
                {' · '}
                <a href={`/observatorio/auditorias/${slug}`} target="_blank" rel="noopener noreferrer" className="font-semibold">
                  Ver la ficha pública ↗
                </a>
              </>
            )}
          </p>

          <div className="space-y-2 border-t border-linea pt-4">
            <label className="mb-1 block text-[12px] font-bold text-gris" htmlFor="rectificar">
              Rectificar (aviso público y versión nueva; deja de sumar en el contador)
            </label>
            <textarea
              id="rectificar"
              rows={3}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Qué se corrige y por qué"
              className={control}
            />
            <button
              type="button"
              disabled={pendiente || nota.trim().length < 10}
              className={botonSecundario}
              onClick={() => lanzar(() => rectificarCaso(alertId, nota), 'Rectificación publicada.')}
            >
              Publicar rectificación
            </button>
          </div>

          {esAdmin && (
            <div className="space-y-2 border-t border-linea pt-4">
              <label className="mb-1 block text-[12px] font-bold text-gris" htmlFor="retirar">
                Retirar de la web (solo admin)
              </label>
              <input
                id="retirar"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Motivo"
                className={control}
              />
              <button
                type="button"
                disabled={pendiente || !motivo.trim()}
                className={botonSecundario}
                onClick={() => lanzar(() => despublicarCaso(alertId, motivo), 'Caso retirado de la web.')}
              >
                Retirar
              </button>
            </div>
          )}
        </div>
      )}

      {rectificaciones.length > 0 && (
        <div className="space-y-3 border-t border-linea pt-4">
          <p className="text-[13.5px] font-bold text-titular">
            Solicitudes de rectificación {pendientes.length > 0 && <span className="text-naranja">({pendientes.length} sin responder · plazo 3 días)</span>}
          </p>
          {rectificaciones.map((r) => (
            <SolicitudRectificacion key={r.id} alertId={alertId} r={r} pendiente={pendiente} lanzar={lanzar} />
          ))}
        </div>
      )}
    </section>
  );
}

function SolicitudRectificacion({
  alertId,
  r,
  pendiente,
  lanzar,
}: {
  alertId: string;
  r: Rectificacion;
  pendiente: boolean;
  lanzar: (accion: () => Promise<{ ok: true } | { error: string }>, exito: string) => void;
}) {
  const [resolucion, setResolucion] = useState<'aceptada' | 'parcial' | 'rechazada'>('aceptada');
  const [nota, setNota] = useState(r.public_note ?? '');
  const vence = new Date(new Date(r.received_at).getTime() + 3 * 86_400_000);

  return (
    <div className={cn('rounded-boton border p-3 text-[13px]', r.resolved_at ? 'border-linea' : 'border-naranja')}>
      <p className="font-bold text-titular">
        {r.requester_name} ({r.requester_role}) · <a href={`mailto:${r.requester_email}`}>{r.requester_email}</a>
      </p>
      <p className="text-[12px] text-gris">
        Recibida el {fecha.format(new Date(r.received_at))}
        {r.resolved_at ? ` · respondida (${r.resolution})` : ` · responder antes del ${fecha.format(vence)}`}
      </p>
      <p className="mt-2 whitespace-pre-wrap text-cuerpo">{r.request_text}</p>
      {!r.resolved_at && (
        <div className="mt-3 space-y-2">
          <select
            value={resolucion}
            onChange={(e) => setResolucion(e.target.value as typeof resolucion)}
            className={control}
            aria-label="Resolución"
          >
            <option value="aceptada">Aceptada</option>
            <option value="parcial">Aceptada en parte</option>
            <option value="rechazada">Rechazada</option>
          </select>
          <textarea
            rows={2}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Respuesta (si se acepta, rectifica también la ficha)"
            className={control}
          />
          <button
            type="button"
            disabled={pendiente}
            className={botonSecundario}
            onClick={() => lanzar(() => resolverRectificacion(alertId, r.id, resolucion, nota), 'Solicitud respondida.')}
          >
            Marcar como respondida
          </button>
        </div>
      )}
    </div>
  );
}
