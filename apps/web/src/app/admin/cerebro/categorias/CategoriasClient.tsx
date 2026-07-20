'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { Input } from '@/components/ui/Input';
import {
  crearCategoria,
  eliminarCategoria,
  renombrarCategoria,
  reordenarCategoria,
  type ResultadoAccion,
} from '@/lib/brain/wikiAdmin';
import { cn } from '@/lib/cn';

export interface FilaCategoria {
  id: string;
  slug: string;
  name: string;
  entradas: number;
  esPrimera: boolean;
  esUltima: boolean;
}

/** Fila editable: nombre en modo lectura, o input + guardar/cancelar en modo edición. */
function FilaEditable({ fila }: { fila: FilaCategoria }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(fila.name);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function guardar() {
    setError(null);
    iniciar(async () => {
      const r = await renombrarCategoria(fila.id, nombre);
      if (!r.ok) {
        setError(r.error ?? 'No se ha podido renombrar.');
        return;
      }
      setEditando(false);
      router.refresh();
    });
  }

  if (!editando) {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate font-bold text-titular">{fila.name}</span>
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="shrink-0 text-[12.5px] font-semibold text-gris hover:text-titular"
        >
          Renombrar
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2 min-[560px]:flex-row min-[560px]:items-center">
      <Input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        className="py-1.5 text-[14px]"
        autoFocus
      />
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={guardar}
          disabled={pendiente}
          className="rounded-boton bg-accion px-3 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-60"
        >
          {pendiente ? 'Guardando…' : 'Guardar'}
        </button>
        <button
          type="button"
          onClick={() => {
            setNombre(fila.name);
            setEditando(false);
            setError(null);
          }}
          disabled={pendiente}
          className="text-[12.5px] font-semibold text-gris hover:text-titular"
        >
          Cancelar
        </button>
      </div>
      {error && <p className="text-[12.5px] text-magenta">{error}</p>}
    </div>
  );
}

export function CategoriasClient({ filas }: { filas: FilaCategoria[] }) {
  const router = useRouter();

  const [montado, setMontado] = useState(false);
  const [borrando, setBorrando] = useState<FilaCategoria | null>(null);
  const [errorBorrado, setErrorBorrado] = useState<string | null>(null);
  const [pendienteAccion, iniciarAccion] = useTransition();

  const [estadoAlta, accionAlta, pendienteAlta] = useActionState<ResultadoAccion | null, FormData>(
    crearCategoria,
    null,
  );

  useEffect(() => setMontado(true), []);
  useEffect(() => {
    if (estadoAlta?.ok) router.refresh();
  }, [estadoAlta, router]);

  function mover(id: string, direccion: 'subir' | 'bajar') {
    iniciarAccion(async () => {
      await reordenarCategoria(id, direccion);
      router.refresh();
    });
  }

  function confirmarBorrado() {
    if (!borrando) return;
    setErrorBorrado(null);
    iniciarAccion(async () => {
      const r = await eliminarCategoria(borrando.id);
      if (!r.ok) {
        setErrorBorrado(r.error ?? 'No se ha podido eliminar.');
        return;
      }
      setBorrando(null);
      router.refresh();
    });
  }

  return (
    <div>
      <ul className="mb-8 overflow-hidden rounded-tarjeta border border-linea bg-white">
        {filas.map((f, i) => (
          <li
            key={f.id}
            className={cn(
              'flex flex-col gap-3 border-b border-linea/60 p-4 last:border-0 min-[640px]:flex-row min-[640px]:items-center',
              i % 2 === 1 ? 'bg-fondo' : 'bg-white',
            )}
          >
            <FilaEditable fila={f} />

            <div className="flex shrink-0 items-center gap-2">
              <span className="rounded-full bg-white px-2.5 py-0.5 text-[12px] font-semibold text-cuerpo ring-1 ring-linea">
                {f.entradas} entrada{f.entradas === 1 ? '' : 's'}
              </span>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => mover(f.id, 'subir')}
                  disabled={f.esPrimera || pendienteAccion}
                  aria-label={`Subir ${f.name}`}
                  className="grid h-8 w-8 place-items-center rounded-boton border border-linea bg-white text-titular disabled:opacity-30 enabled:hover:border-titular"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => mover(f.id, 'bajar')}
                  disabled={f.esUltima || pendienteAccion}
                  aria-label={`Bajar ${f.name}`}
                  className="grid h-8 w-8 place-items-center rounded-boton border border-linea bg-white text-titular disabled:opacity-30 enabled:hover:border-titular"
                >
                  ↓
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setErrorBorrado(null);
                  setBorrando(f);
                }}
                className="rounded-boton border border-magenta/30 bg-magenta/5 px-3 py-1.5 text-[12.5px] font-bold text-magenta hover:bg-magenta/10"
              >
                Eliminar
              </button>
            </div>
          </li>
        ))}
        {filas.length === 0 && (
          <li className="p-6 text-center text-[13.5px] text-gris">Todavía no hay categorías.</li>
        )}
      </ul>

      <div className="rounded-tarjeta border border-linea bg-white p-5">
        <h2 className="mb-3 text-[13px] font-bold uppercase tracking-[.08em] text-gris">
          Nueva categoría
        </h2>
        <form action={accionAlta} className="flex flex-col gap-3 min-[560px]:flex-row">
          <Input
            name="name"
            placeholder="Nombre de la categoría"
            required
            className="min-[560px]:flex-1"
          />
          <button
            type="submit"
            disabled={pendienteAlta}
            className="rounded-boton bg-accion px-6 py-3 text-[14px] font-bold text-white shadow-boton disabled:opacity-60"
          >
            {pendienteAlta ? 'Creando…' : 'Crear'}
          </button>
        </form>
        {estadoAlta?.error ? (
          <p className="mt-3 text-[13px] font-semibold text-magenta">{estadoAlta.error}</p>
        ) : null}
        <p className="mt-3 text-[12.5px] text-gris">
          El slug se genera automáticamente del nombre (sin acentos, en minúsculas).
        </p>
      </div>

      {/* Modal de confirmación de borrado (portal a <body>) */}
      {borrando &&
        montado &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Confirmar eliminación de categoría"
            className="fixed inset-0 z-[70] flex items-center justify-center bg-noche/40 p-4"
            onClick={() => !pendienteAccion && setBorrando(null)}
          >
            <div
              className="w-full max-w-md rounded-tarjeta border border-linea bg-white p-6 shadow-nav motion-safe:animate-[sube_.25s_ease]"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-[19px] font-bold text-titular">¿Eliminar «{borrando.name}»?</h2>
              <p className="mt-2 text-[14px] text-cuerpo">
                {borrando.entradas > 0
                  ? `Esta categoría tiene ${borrando.entradas} entrada${borrando.entradas === 1 ? '' : 's'}. Muévelas a otra categoría o bórralas antes de eliminarla.`
                  : 'Esta acción no se puede deshacer.'}
              </p>
              {errorBorrado && (
                <p className="mt-3 rounded-boton border border-magenta/40 bg-magenta/5 px-3 py-2 text-[13px] font-semibold text-magenta">
                  {errorBorrado}
                </p>
              )}
              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setBorrando(null)}
                  disabled={pendienteAccion}
                  className="rounded-boton border border-linea bg-white px-4 py-2 text-[14px] font-bold text-titular hover:border-titular disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmarBorrado}
                  disabled={pendienteAccion || borrando.entradas > 0}
                  className="rounded-boton bg-magenta px-4 py-2 text-[14px] font-bold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-40"
                >
                  {pendienteAccion ? 'Eliminando…' : 'Eliminar'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
