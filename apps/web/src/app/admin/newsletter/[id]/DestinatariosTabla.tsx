'use client';

import { useMemo, useState } from 'react';

export interface FilaDestinatario {
  id: string;
  nombre: string;
  email: string;
  recibido: string | null;
  estado: string;
  abierto: boolean;
  clic: boolean;
  /** Preguntas respondidas; null si la campaña no va ligada a encuesta. */
  hechas: number | null;
}

const POR_PAGINA = 10;

export function DestinatariosTabla({ filas, totalPreguntas }: { filas: FilaDestinatario[]; totalPreguntas: number }) {
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(0);
  const conEncuesta = filas.some((f) => f.hechas !== null);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return q ? filas.filter((f) => f.nombre.toLowerCase().includes(q) || f.email.toLowerCase().includes(q)) : filas;
  }, [filas, busca]);
  const paginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const actual = Math.min(pagina, paginas - 1);
  const visibles = filtradas.slice(actual * POR_PAGINA, (actual + 1) * POR_PAGINA);

  return (
    <section className="rounded-tarjeta border border-linea bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold text-titular">Destinatarios ({filas.length})</h2>
        <input
          type="search"
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setPagina(0);
          }}
          placeholder="Buscar por nombre o correo"
          aria-label="Buscar destinatario"
          className="w-full max-w-[280px] rounded-boton border border-linea px-3 py-1.5 text-[13px]"
        />
      </div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[11.5px] font-bold uppercase tracking-wide text-gris">
              <th className="py-2 pr-3">Persona</th>
              <th className="py-2 pr-3">Recibido</th>
              <th className="py-2 pr-3">Abierto</th>
              {conEncuesta && <th className="py-2">Encuesta</th>}
            </tr>
          </thead>
          <tbody>
            {visibles.map((f) => (
              <tr key={f.id} className="border-t border-linea">
                <td className="py-2 pr-3">
                  <span className="font-semibold text-titular">{f.nombre}</span>
                  <span className="block text-[12px] text-gris">{f.email}</span>
                </td>
                <td className="py-2 pr-3 text-cuerpo">{f.recibido ?? <span className="text-gris">{f.estado}</span>}</td>
                <td className="py-2 pr-3">
                  {f.abierto ? <span className="font-semibold text-teal-texto">Sí{f.clic ? ' · clic' : ''}</span> : <span className="text-gris">No</span>}
                </td>
                {conEncuesta && (
                  <td className="py-2">
                    {totalPreguntas > 0 && (f.hechas ?? 0) >= totalPreguntas ? (
                      <span className="font-semibold text-teal-texto">Completada</span>
                    ) : f.hechas ? (
                      <span className="text-naranja">
                        {f.hechas}/{totalPreguntas}
                      </span>
                    ) : (
                      <span className="text-gris">No</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {!visibles.length && (
              <tr>
                <td colSpan={4} className="py-3 text-gris">
                  {busca ? 'Nadie coincide con la búsqueda.' : 'Sin destinatarios.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {paginas > 1 && (
        <div className="mt-3 flex items-center justify-between text-[12.5px] text-gris">
          <span>
            {actual * POR_PAGINA + 1}–{Math.min((actual + 1) * POR_PAGINA, filtradas.length)} de {filtradas.length}
          </span>
          <div className="flex gap-2">
            <button type="button" disabled={actual === 0} onClick={() => setPagina(actual - 1)} className="rounded-boton border border-linea px-3 py-1 font-semibold text-titular disabled:opacity-40">
              ← Anterior
            </button>
            <span className="self-center">
              {actual + 1} / {paginas}
            </span>
            <button type="button" disabled={actual >= paginas - 1} onClick={() => setPagina(actual + 1)} className="rounded-boton border border-linea px-3 py-1 font-semibold text-titular disabled:opacity-40">
              Siguiente →
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
