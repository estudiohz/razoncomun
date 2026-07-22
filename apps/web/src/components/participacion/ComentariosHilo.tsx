'use client';

import { useState, useTransition } from 'react';
import {
  alternarLikeAction,
  anadirComentarioAction,
  borrarComentarioAction,
} from '@/app/propuestas/actions';
import type { ComentarioConAutor } from '@/lib/participacion/comments';

function fecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Comentarios conversacionales del hilo (D-P4/D-P5): sección principal
 * siempre activa (a diferencia del panel Polis, que solo aparece en
 * deliberación). Un solo nivel de respuesta.
 */
export function ComentariosHilo({
  proposalId,
  comentarios,
  misLikes,
  userId,
  puedeParticipar,
}: {
  proposalId: string;
  comentarios: ComentarioConAutor[];
  misLikes: Record<string, boolean>;
  userId: string | null;
  puedeParticipar: boolean;
}) {
  const raiz = comentarios.filter((c) => !c.parent_id);
  const respuestasDe = (id: string) => comentarios.filter((c) => c.parent_id === id);

  return (
    <div className="space-y-6">
      {puedeParticipar && <FormularioComentario proposalId={proposalId} />}
      {!puedeParticipar && (
        <p className="text-[13.5px] text-gris">Entra para comentar y dar like.</p>
      )}

      <div className="space-y-5">
        {raiz.length === 0 && <p className="text-[14px] text-gris">Sin comentarios todavía. Sé el primero.</p>}
        {raiz.map((c) => (
          <Comentario
            key={c.id}
            comentario={c}
            respuestas={respuestasDe(c.id)}
            proposalId={proposalId}
            misLikes={misLikes}
            userId={userId}
            puedeParticipar={puedeParticipar}
          />
        ))}
      </div>
    </div>
  );
}

function Comentario({
  comentario,
  respuestas,
  proposalId,
  misLikes,
  userId,
  puedeParticipar,
}: {
  comentario: ComentarioConAutor;
  respuestas: ComentarioConAutor[];
  proposalId: string;
  misLikes: Record<string, boolean>;
  userId: string | null;
  puedeParticipar: boolean;
}) {
  const [respondiendo, setRespondiendo] = useState(false);

  return (
    <div className="rounded-tarjeta border border-linea bg-panel p-5">
      <FilaComentario comentario={comentario} misLikes={misLikes} userId={userId} />
      {puedeParticipar && (
        <button
          type="button"
          onClick={() => setRespondiendo((v) => !v)}
          className="mt-2 text-[12.5px] font-semibold text-titular underline"
        >
          {respondiendo ? 'Cancelar' : 'Responder'}
        </button>
      )}
      {respondiendo && (
        <div className="mt-3">
          <FormularioComentario
            proposalId={proposalId}
            parentId={comentario.id}
            alEnviar={() => setRespondiendo(false)}
          />
        </div>
      )}
      {respuestas.length > 0 && (
        <div className="mt-4 space-y-3 border-l-2 border-linea pl-4">
          {respuestas.map((r) => (
            <FilaComentario key={r.id} comentario={r} misLikes={misLikes} userId={userId} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilaComentario({
  comentario,
  misLikes,
  userId,
}: {
  comentario: ComentarioConAutor;
  misLikes: Record<string, boolean>;
  userId: string | null;
}) {
  const [pendiente, iniciar] = useTransition();
  const esBorrado = comentario.body === null;
  const puedeBorrar = userId && comentario.author_id === userId && !esBorrado;
  const yaLeDioLike = Boolean(misLikes[comentario.id]);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-bold text-titular">
          {comentario.autor_nombre ?? 'Alguien de la comunidad'}
        </span>
        <span className="text-[11.5px] text-gris">{fecha(comentario.created_at)}</span>
      </div>
      <p className={esBorrado ? 'mt-1 text-[14px] italic text-gris' : 'mt-1 whitespace-pre-line text-[14px] text-cuerpo'}>
        {esBorrado ? '[comentario eliminado]' : comentario.body}
      </p>
      {!esBorrado && (
        <div className="mt-1.5 flex items-center gap-3">
          <button
            type="button"
            disabled={pendiente}
            onClick={() => iniciar(() => alternarLikeAction(comentario.id))}
            className={
              'text-[12.5px] font-semibold ' + (yaLeDioLike ? 'text-accion' : 'text-gris hover:text-titular')
            }
          >
            👍 {comentario.like_count}
          </button>
          {puedeBorrar && (
            <button
              type="button"
              disabled={pendiente}
              onClick={() => iniciar(() => borrarComentarioAction(comentario.id, comentario.proposal_id))}
              className="text-[12.5px] font-semibold text-gris hover:text-magenta"
            >
              Borrar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FormularioComentario({
  proposalId,
  parentId,
  alEnviar,
}: {
  proposalId: string;
  parentId?: string;
  alEnviar?: () => void;
}) {
  const [texto, setTexto] = useState('');
  const [enviando, iniciar] = useTransition();

  return (
    <form
      action={() =>
        iniciar(async () => {
          if (!texto.trim()) return;
          await anadirComentarioAction(proposalId, texto, parentId ?? null);
          setTexto('');
          alEnviar?.();
        })
      }
      className="space-y-2"
    >
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={parentId ? 2 : 3}
        maxLength={2000}
        placeholder={parentId ? 'Escribe una respuesta…' : 'Añade un comentario…'}
        className="w-full rounded-boton border border-linea bg-white px-4 py-2.5 text-[14px]"
      />
      <button
        type="submit"
        disabled={enviando || !texto.trim()}
        className="rounded-boton bg-accion px-5 py-2 text-[13.5px] font-bold text-white disabled:opacity-60"
      >
        {enviando ? 'Enviando…' : parentId ? 'Responder' : 'Comentar'}
      </button>
    </form>
  );
}
