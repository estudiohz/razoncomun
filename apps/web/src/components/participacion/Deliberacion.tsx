'use client';

import { useState, useTransition } from 'react';
import { anadirAfirmacionAction, votarAfirmacionAction } from '@/app/propuestas/actions';
import type { Statement, StatementTally, ValorVotoAfirmacion } from '@/lib/participacion/types';
import { cn } from '@/lib/cn';

interface Fila {
  statement: Statement;
  tally: StatementTally | null;
}

/**
 * Deliberación estilo Polis (programa-vivo.md): afirmaciones votables de
 * acuerdo/en desacuerdo/paso, resultados agregados siempre visibles (nunca
 * el voto individual de otros — statement_votes es "propia" en RLS), y
 * formulario para añadir una afirmación nueva.
 */
export function Deliberacion({
  proposalId,
  filas,
  misVotos,
  puedeParticipar,
}: {
  proposalId: string;
  filas: Fila[];
  misVotos: Record<string, ValorVotoAfirmacion>;
  puedeParticipar: boolean;
}) {
  const [pendiente, iniciarTransicion] = useTransition();
  const [texto, setTexto] = useState('');

  function votar(statementId: string, valor: ValorVotoAfirmacion) {
    iniciarTransicion(() => votarAfirmacionAction(proposalId, statementId, valor));
  }

  function enviarAfirmacion() {
    if (!texto.trim()) return;
    iniciarTransicion(async () => {
      await anadirAfirmacionAction(proposalId, texto);
      setTexto('');
    });
  }

  return (
    <div className="space-y-4">
      {filas.length === 0 && (
        <p className="text-[14px] text-gris">Todavía no hay afirmaciones. Sé el primero en aportar una.</p>
      )}

      {filas.map(({ statement, tally }) => {
        const total = tally?.total_count ?? 0;
        const acuerdo = tally?.agree_count ?? 0;
        const desacuerdo = tally?.disagree_count ?? 0;
        const paso = tally?.pass_count ?? 0;
        const pctAcuerdo = total > 0 ? Math.round((acuerdo / total) * 100) : 0;
        const pctDesacuerdo = total > 0 ? Math.round((desacuerdo / total) * 100) : 0;
        const pctPaso = total > 0 ? 100 - pctAcuerdo - pctDesacuerdo : 0;
        const miVoto = misVotos[statement.id];

        return (
          <div key={statement.id} className="rounded-tarjeta border border-linea bg-panel p-5">
            <p className="text-[15px] font-medium text-titular">{statement.text}</p>

            {/* Resultado agregado — siempre visible, nunca el voto individual ajeno */}
            <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-fondo">
              <div className="bg-cat-agricultura" style={{ width: `${pctAcuerdo}%` }} />
              <div className="bg-gris/40" style={{ width: `${pctPaso}%` }} />
              <div className="bg-cat-sanidad" style={{ width: `${pctDesacuerdo}%` }} />
            </div>
            <p className="mt-1.5 text-[12px] text-gris">
              {acuerdo} de acuerdo · {paso} paso · {desacuerdo} en desacuerdo ({total} votos)
            </p>

            {puedeParticipar ? (
              <div className="mt-3 flex gap-2">
                <BotonVoto activo={miVoto === 1} onClick={() => votar(statement.id, 1)} disabled={pendiente}>
                  De acuerdo
                </BotonVoto>
                <BotonVoto activo={miVoto === 0} onClick={() => votar(statement.id, 0)} disabled={pendiente}>
                  Paso
                </BotonVoto>
                <BotonVoto activo={miVoto === -1} onClick={() => votar(statement.id, -1)} disabled={pendiente}>
                  En desacuerdo
                </BotonVoto>
              </div>
            ) : (
              <p className="mt-3 text-[12.5px] text-gris">
                <a href={`/entrar?next=/propuestas/${proposalId}`} className="font-semibold text-titular underline">
                  Entra o regístrate
                </a>{' '}
                para votar esta afirmación.
              </p>
            )}
          </div>
        );
      })}

      {puedeParticipar && (
        <div className="rounded-tarjeta border border-dashed border-linea bg-fondo p-5">
          <label htmlFor="nueva-afirmacion" className="mb-1.5 block text-[13.5px] font-semibold">
            Añade una afirmación a la deliberación
          </label>
          <textarea
            id="nueva-afirmacion"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={2}
            maxLength={280}
            placeholder="Una idea concreta y votable, no una pregunta ni un ataque personal."
            className="w-full rounded-boton border border-linea bg-white px-4 py-2.5 text-[14px]"
          />
          <button
            type="button"
            disabled={pendiente || !texto.trim()}
            onClick={enviarAfirmacion}
            className="mt-2 rounded-boton bg-accion px-4 py-2 text-[13px] font-bold text-white shadow-boton disabled:opacity-50"
          >
            Añadir afirmación
          </button>
        </div>
      )}
    </div>
  );
}

function BotonVoto({
  activo,
  disabled,
  onClick,
  children,
}: {
  activo: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded-boton border px-3.5 py-1.5 text-[12.5px] font-bold transition-colors',
        activo ? 'border-accion bg-accion text-white' : 'border-linea bg-white text-cuerpo hover:border-titular',
        disabled && 'opacity-60',
      )}
    >
      {children}
    </button>
  );
}
