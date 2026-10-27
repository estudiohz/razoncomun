'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { EstadoBadge } from '@/components/participacion/EstadoBadge';
import type { EstadoPropuesta } from '@/lib/participacion/types';

export interface IdeaResumen {
  id: string;
  slug: string | null;
  title: string;
  status: EstadoPropuesta;
  category_id: string | null;
  support_count: number;
}

export interface CategoriaResumen {
  id: string;
  nombre: string;
  color: string;
}

const chip = (activo: boolean) =>
  cn(
    'rounded-full border px-[18px] py-[9px] text-[13.5px] font-semibold transition-colors',
    activo ? 'border-accion bg-accion text-white' : 'border-linea bg-white text-cuerpo hover:border-titular',
  );

/** "¿Qué te importa?": filtra las propuestas vivas por tema, sin recargar. */
export function ExplorarIdeas({
  ideas,
  categorias,
}: {
  ideas: IdeaResumen[];
  categorias: CategoriaResumen[];
}) {
  const [cat, setCat] = useState<string | null>(null);
  const conIdeas = useMemo(
    () => categorias.filter((c) => ideas.some((i) => i.category_id === c.id)),
    [categorias, ideas],
  );
  const visibles = useMemo(
    () => (cat ? ideas.filter((i) => i.category_id === cat) : ideas).slice(0, 6),
    [cat, ideas],
  );
  const color = (id: string | null) => categorias.find((c) => c.id === id)?.color ?? '#16B8A0';

  return (
    <div>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={() => setCat(null)} className={chip(cat === null)}>
          Todo
        </button>
        {conIdeas.map((c) => (
          <button key={c.id} type="button" onClick={() => setCat(c.id)} className={chip(cat === c.id)}>
            {c.nombre}
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-4 min-[720px]:grid-cols-2 min-[1000px]:grid-cols-3">
        {visibles.map((i) => (
          <Link
            key={i.id}
            href={`/propuestas/${i.slug ?? i.id}`}
            className="flex flex-col rounded-tarjeta border border-linea bg-panel p-5 no-underline transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-tarjeta"
            style={{ borderTop: `4px solid ${color(i.category_id)}` }}
          >
            <EstadoBadge status={i.status} className="self-start" />
            <h3 className="mt-3 flex-1 text-[17px] font-extrabold leading-snug text-titular">{i.title}</h3>
            <p className="mt-4 text-[13px] font-semibold text-gris">
              👍 {i.support_count} {i.support_count === 1 ? 'apoyo' : 'apoyos'}
            </p>
          </Link>
        ))}
        {visibles.length === 0 && (
          <p className="col-span-full text-center text-[15px] text-gris">
            Aún no hay propuestas en este tema. Puedes ser quien abra el debate.
          </p>
        )}
      </div>
    </div>
  );
}
