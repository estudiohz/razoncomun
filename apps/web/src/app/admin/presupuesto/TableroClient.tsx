'use client';

import Link from 'next/link';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { formatoEuros } from '@/lib/simulador/formato';

export interface Ficha {
  id: string;
  tipo: 'ingreso' | 'gasto';
  nombre: string;
  actualCents: number | null;
  rcCents: number | null;
  nPartidas: number;
  publicado: boolean;
  sinFuente: boolean;
  descuadre: boolean;
  roto: boolean;
}

function Estado({ ficha }: { ficha: Ficha }) {
  const chips: { texto: string; clase: string }[] = [];
  if (!ficha.publicado) chips.push({ texto: '🔒 Borrador', clase: 'bg-gris/15 text-gris' });
  if (ficha.roto) chips.push({ texto: '✗ Fórmula rota', clase: 'bg-magenta/10 text-magenta' });
  if (ficha.descuadre) chips.push({ texto: '⚠ Descuadre', clase: 'bg-naranja/10 text-naranja' });
  if (ficha.sinFuente) chips.push({ texto: 'Sin fuente', clase: 'bg-naranja/10 text-naranja' });
  if (chips.length === 0) chips.push({ texto: '✔ Con datos', clase: 'bg-accion/10 text-accion' });

  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <span key={c.texto} className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-bold', c.clase)}>
          {c.texto}
        </span>
      ))}
    </div>
  );
}

function TarjetaFicha({ ficha }: { ficha: Ficha }) {
  return (
    <Link
      href={`/admin/presupuesto/${ficha.id}`}
      className="block rounded-tarjeta border border-linea bg-white p-5 no-underline transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(.16,1,.3,1)] hover:-translate-y-1 hover:shadow-tarjeta"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[16.5px] font-bold text-titular">{ficha.nombre}</h3>
        <span className="shrink-0 rounded-full bg-fondo px-2 py-0.5 text-[11px] font-semibold text-gris">
          {ficha.nPartidas} partida{ficha.nPartidas === 1 ? '' : 's'}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-gris">Actual</p>
          <p className="text-[16px] font-bold text-cuerpo">{formatoEuros(ficha.actualCents)}</p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-gris">Razón Común</p>
          <p className="text-[16px] font-bold text-titular">{formatoEuros(ficha.rcCents)}</p>
        </div>
      </div>
      <div className="mt-3">
        <Estado ficha={ficha} />
      </div>
    </Link>
  );
}

export function TableroClient({ fichas }: { fichas: Ficha[] }) {
  const [tab, setTab] = useState<'gasto' | 'ingreso'>('gasto');
  const filtradas = fichas.filter((f) => f.tipo === tab);

  return (
    <div>
      <div className="mb-4 inline-flex rounded-boton border border-linea bg-white p-1">
        {(['gasto', 'ingreso'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'rounded-boton px-4 py-2 text-[13.5px] font-bold transition-colors',
              tab === t ? 'bg-accion text-white' : 'text-cuerpo hover:text-titular',
            )}
          >
            {t === 'gasto' ? 'Gastos' : 'Ingresos'} ({fichas.filter((f) => f.tipo === t).length})
          </button>
        ))}
      </div>

      {filtradas.length === 0 ? (
        <p className="rounded-tarjeta border border-linea bg-white p-6 text-cuerpo">
          Todavía no hay áreas de {tab === 'gasto' ? 'gasto' : 'ingreso'}.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2 min-[1100px]:grid-cols-3">
          {filtradas.map((f) => (
            <TarjetaFicha key={f.id} ficha={f} />
          ))}
        </div>
      )}
    </div>
  );
}
