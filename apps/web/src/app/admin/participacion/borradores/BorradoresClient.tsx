'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { publicarBorradorAction, descartarBorradorAction } from './actions';
import type { Propuesta } from '@/lib/participacion/types';

/**
 * Cola de borradores (D-U5). Publicar = draft → seed; descartar = draft →
 * archived. Ambos pasan por el trigger de BD que exige coordinator/admin, así
 * que un editor "a secas" verá el error real devuelto por Postgres en vez de
 * un botón que finge funcionar.
 */
export function BorradoresClient({ borradores }: { borradores: Propuesta[] }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [actuando, setActuando] = useState<string | null>(null);

  function ejecutar(id: string, accion: 'publicar' | 'descartar') {
    setError(null);
    setActuando(id);
    iniciar(async () => {
      const r =
        accion === 'publicar'
          ? await publicarBorradorAction(id)
          : await descartarBorradorAction(id);
      setActuando(null);
      if (!r.ok) {
        setError(r.error ?? 'No se ha podido completar la acción.');
        return;
      }
      router.refresh();
    });
  }

  if (borradores.length === 0) {
    return (
      <p className="rounded-tarjeta border border-linea bg-panel p-6 text-center text-[14px] text-gris">
        No hay borradores pendientes de revisión.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-boton bg-magenta/10 px-3.5 py-2.5 text-[13px] font-medium text-magenta">
          {error}
        </p>
      )}

      {borradores.map((p) => (
        <article key={p.id} className="rounded-tarjeta border border-linea bg-panel p-5 shadow-nav">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[17px] font-extrabold text-titular">{p.title}</h2>
              <p className="mt-1 text-[12.5px] text-gris">
                {p.department} · creado el{' '}
                {new Date(p.created_at).toLocaleDateString('es-ES', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                disabled={pendiente && actuando === p.id}
                onClick={() => ejecutar(p.id, 'publicar')}
                className="rounded-boton bg-accion px-4 py-2 text-[13px] font-bold text-white shadow-boton disabled:opacity-50"
              >
                {pendiente && actuando === p.id ? 'Publicando…' : 'Publicar'}
              </button>
              <button
                type="button"
                disabled={pendiente && actuando === p.id}
                onClick={() => ejecutar(p.id, 'descartar')}
                className="rounded-boton border border-linea bg-white px-4 py-2 text-[13px] font-bold text-cuerpo hover:border-magenta hover:text-magenta disabled:opacity-50"
              >
                Descartar
              </button>
            </div>
          </div>

          <p className="mt-3 whitespace-pre-line text-[14px] text-cuerpo">{p.body}</p>

          <Link
            href={`/propuestas/${p.slug ?? p.id}`}
            className="mt-3 inline-block text-[13px] font-semibold text-titular underline"
          >
            Ver la ficha completa
          </Link>
        </article>
      ))}
    </div>
  );
}
