'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  archivarAction,
  cambiarEstadoAction,
  eliminarAction,
  fijarDeadlineAction,
  fusionarAction,
  publicarRespuestaOficialAction,
} from '../actions';
import { ETIQUETA_ESTADO, ORDEN_ESTADOS, type EstadoPropuesta, type Propuesta } from '@/lib/participacion/types';

const TODOS_ESTADOS: EstadoPropuesta[] = [...ORDEN_ESTADOS, 'archived'];

function paraInputLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ModerarPropuestaClient({ propuesta }: { propuesta: Propuesta }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [errorEstado, setErrorEstado] = useState<string | null>(null);
  const [errorDeadline, setErrorDeadline] = useState<string | null>(null);
  const [errorRespuesta, setErrorRespuesta] = useState<string | null>(null);
  const [errorFusion, setErrorFusion] = useState<string | null>(null);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);
  const [motivoEliminar, setMotivoEliminar] = useState('');

  function onCambiarEstado(fd: FormData) {
    setErrorEstado(null);
    iniciar(async () => {
      const r = await cambiarEstadoAction(propuesta.id, fd);
      if (!r.ok) setErrorEstado(r.error ?? 'Error desconocido.');
      else router.refresh();
    });
  }

  function onFijarDeadline(fd: FormData) {
    setErrorDeadline(null);
    iniciar(async () => {
      const r = await fijarDeadlineAction(propuesta.id, fd);
      if (!r.ok) setErrorDeadline(r.error ?? 'Error desconocido.');
      else router.refresh();
    });
  }

  function onPublicarRespuesta(fd: FormData) {
    setErrorRespuesta(null);
    iniciar(async () => {
      const r = await publicarRespuestaOficialAction(propuesta.id, fd);
      if (!r.ok) setErrorRespuesta(r.error ?? 'Error desconocido.');
      else router.refresh();
    });
  }

  function onFusionar(fd: FormData) {
    setErrorFusion(null);
    iniciar(async () => {
      const r = await fusionarAction(propuesta.id, fd);
      if (r && !r.ok) setErrorFusion(r.error ?? 'Error desconocido.');
      // éxito: la action redirige, no llega aquí
    });
  }

  function onArchivar() {
    if (!window.confirm(`¿Archivar «${propuesta.title}»? Dejará de verse en el tablero público.`)) return;
    iniciar(async () => {
      const r = await archivarAction(propuesta.id);
      if (!r.ok) window.alert(r.error ?? 'No se ha podido archivar.');
      else router.refresh();
    });
  }

  function onEliminar() {
    setErrorEliminar(null);
    iniciar(async () => {
      const r = await eliminarAction(propuesta.id, motivoEliminar);
      if (r && !r.ok) setErrorEliminar(r.error ?? 'Error desconocido.');
      // éxito: la action redirige
    });
  }

  return (
    <div className="grid gap-6 min-[960px]:grid-cols-2">
      {/* Estado */}
      <section className="rounded-tarjeta border border-linea bg-white p-5">
        <h2 className="mb-3 text-[13px] font-bold uppercase tracking-[.08em] text-gris">Estado</h2>
        <form action={onCambiarEstado} className="flex flex-wrap items-center gap-3">
          <select
            name="status"
            defaultValue={propuesta.status}
            className="rounded-boton border border-linea bg-white px-3 py-2 text-[14px] text-titular"
          >
            {TODOS_ESTADOS.map((s) => (
              <option key={s} value={s}>
                {ETIQUETA_ESTADO[s]}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={pendiente}
            className="rounded-boton bg-accion px-4 py-2 text-[13.5px] font-bold text-white disabled:opacity-60"
          >
            Guardar estado
          </button>
        </form>
        {errorEstado && <p className="mt-3 text-[13px] font-semibold text-magenta">{errorEstado}</p>}
        <p className="mt-3 text-[12.5px] text-gris">
          Notifica en la app a quienes apoyaron o siguen el hilo (D-P9). Protegido en BD: solo
          coordinator/admin.
        </p>
      </section>

      {/* Fecha límite */}
      <section className="rounded-tarjeta border border-linea bg-white p-5">
        <h2 className="mb-3 text-[13px] font-bold uppercase tracking-[.08em] text-gris">Fecha límite</h2>
        <form action={onFijarDeadline} className="flex flex-wrap items-center gap-3">
          <input
            type="datetime-local"
            name="deadline_at"
            defaultValue={paraInputLocal(propuesta.deadline_at)}
            className="rounded-boton border border-linea bg-white px-3 py-2 text-[14px] text-titular"
          />
          <button
            type="submit"
            disabled={pendiente}
            className="rounded-boton bg-accion px-4 py-2 text-[13.5px] font-bold text-white disabled:opacity-60"
          >
            Guardar
          </button>
        </form>
        {errorDeadline && <p className="mt-3 text-[13px] font-semibold text-magenta">{errorDeadline}</p>}
        <p className="mt-3 text-[12.5px] text-gris">Deja vacío para quitar la fecha límite (sin límite).</p>
      </section>

      {/* Respuesta oficial */}
      <section className="rounded-tarjeta border border-linea bg-white p-5 min-[960px]:col-span-2">
        <h2 className="mb-3 text-[13px] font-bold uppercase tracking-[.08em] text-gris">Respuesta oficial</h2>
        {propuesta.official_response && (
          <div className="mb-3 rounded-boton border border-linea bg-fondo p-3 text-[13.5px] text-cuerpo">
            <p className="whitespace-pre-wrap">{propuesta.official_response}</p>
            {propuesta.official_response_at && (
              <p className="mt-2 text-[11.5px] text-gris">
                Publicada el {new Date(propuesta.official_response_at).toLocaleString('es-ES')}
              </p>
            )}
          </div>
        )}
        <form action={onPublicarRespuesta} className="flex flex-col gap-3">
          <textarea
            name="official_response"
            rows={4}
            defaultValue={propuesta.official_response ?? ''}
            placeholder="Respuesta oficial fijada arriba del hilo público…"
            className="rounded-boton border border-linea bg-white px-3 py-2 text-[14px] text-titular"
          />
          <button
            type="submit"
            disabled={pendiente}
            className="self-start rounded-boton bg-accion px-4 py-2 text-[13.5px] font-bold text-white disabled:opacity-60"
          >
            Publicar respuesta
          </button>
        </form>
        {errorRespuesta && <p className="mt-3 text-[13px] font-semibold text-magenta">{errorRespuesta}</p>}
      </section>

      {/* Fusión de duplicados */}
      <section className="rounded-tarjeta border border-linea bg-white p-5">
        <h2 className="mb-3 text-[13px] font-bold uppercase tracking-[.08em] text-gris">Fusionar en otra propuesta</h2>
        <p className="mb-3 text-[12.5px] text-gris">
          Esta propuesta (B) se fusiona en la que indiques (A): sus apoyos, comentarios y
          seguidores se mueven a A; B queda archivada. Rechazado si A tiene la votación cerrada.
        </p>
        <form action={onFusionar} className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            name="destino"
            placeholder="Id o slug de la propuesta destino (A)"
            required
            className="min-w-[240px] flex-1 rounded-boton border border-linea bg-white px-3 py-2 text-[14px] text-titular"
          />
          <button
            type="submit"
            disabled={pendiente}
            className="rounded-boton border border-titular bg-white px-4 py-2 text-[13.5px] font-bold text-titular disabled:opacity-60"
          >
            Fusionar
          </button>
        </form>
        {errorFusion && <p className="mt-3 text-[13px] font-semibold text-magenta">{errorFusion}</p>}
      </section>

      {/* Archivar / Eliminar */}
      <section className="rounded-tarjeta border border-magenta/30 bg-magenta/5 p-5">
        <h2 className="mb-3 text-[13px] font-bold uppercase tracking-[.08em] text-magenta">Zona de riesgo</h2>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onArchivar}
            disabled={pendiente || propuesta.status === 'archived'}
            className="rounded-boton border border-linea bg-white px-4 py-2 text-[13.5px] font-bold text-titular disabled:opacity-50"
          >
            Archivar (soft)
          </button>
          <button
            type="button"
            onClick={() => setConfirmandoEliminar(true)}
            disabled={pendiente}
            className="rounded-boton bg-magenta px-4 py-2 text-[13.5px] font-bold text-white disabled:opacity-50"
          >
            Eliminar definitivamente
          </button>
        </div>

        {confirmandoEliminar && (
          <div className="mt-4 rounded-boton border border-magenta/40 bg-white p-4">
            <p className="mb-2 text-[13.5px] font-semibold text-titular">
              Esta acción es irreversible. Escribe el motivo (queda en audit_log):
            </p>
            <textarea
              value={motivoEliminar}
              onChange={(e) => setMotivoEliminar(e.target.value)}
              rows={2}
              className="mb-3 w-full rounded-boton border border-linea bg-white px-3 py-2 text-[14px] text-titular"
              placeholder="Motivo obligatorio…"
            />
            {errorEliminar && <p className="mb-2 text-[13px] font-semibold text-magenta">{errorEliminar}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onEliminar}
                disabled={pendiente || !motivoEliminar.trim()}
                className="rounded-boton bg-magenta px-4 py-2 text-[13px] font-bold text-white disabled:opacity-40"
              >
                Confirmar eliminación
              </button>
              <button
                type="button"
                onClick={() => setConfirmandoEliminar(false)}
                className="rounded-boton border border-linea bg-white px-4 py-2 text-[13px] font-bold text-titular"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
