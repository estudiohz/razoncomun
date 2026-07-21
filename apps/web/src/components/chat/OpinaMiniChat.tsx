'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Parte interactiva de la sección "Habla con nuestra IA y aporta tu idea"
 * (home, IASection.tsx) -- rc-04 dejó la UI "Jarvis" sin backend a propósito
 * ("rc-08 conecta el chat real"). Este componente es esa conexión: llama a
 * /api/opina (proxy fino -> rc-brain-service /opina/turn), que ejecuta el
 * entrevistador de docs/tecnico/chatbot-opina.md (apertura, 1-2 repreguntas,
 * cierre con bucle de retorno) y clasifica el resultado en `opinions`.
 *
 * Cliente sin memoria de servidor: este componente manda el `history`
 * completo en cada turno (ver lib/brain/service/src/opinaFlow.mjs).
 */

type Turn = { role: 'user' | 'assistant'; text: string };

function sessionId() {
  if (typeof window === 'undefined') return 'ssr';
  const key = 'rc-opina-session';
  let id = window.sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    window.sessionStorage.setItem(key, id);
  }
  return id;
}

export function OpinaMiniChat() {
  const [history, setHistory] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const send = useCallback(
    async (message: string | null) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/opina', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, history, sessionId: sessionId() }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error || 'No se pudo contactar con Opina.');
          return;
        }
        setHistory((h) => (data.history ? [...h, ...data.history.slice(h.length)] : h));
        if (data.done) setDone(true);
      } catch {
        setError('No se pudo contactar con Opina. Inténtalo de nuevo.');
      } finally {
        setLoading(false);
      }
    },
    [history],
  );

  const onFocusFirstTime = () => {
    if (!started.current) {
      started.current = true;
      void send(null); // apertura contextual, sin mensaje de usuario
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading || done) return;
    setInput('');
    setHistory((h) => [...h, { role: 'user', text }]);
    await send(text);
  };

  return (
    <div>
      <form
        onSubmit={onSubmit}
        className="flex max-w-[470px] items-center gap-3 rounded-[18px] border border-cian/30 bg-white/[.06] py-2 pl-[22px] pr-2 backdrop-blur-[6px]"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={onFocusFirstTime}
          disabled={done}
          placeholder={done ? 'Gracias por tu aportación.' : 'Pregúntale a nuestra IA…'}
          aria-label="Pregúntale a nuestra IA"
          className="flex-1 overflow-hidden bg-transparent text-[15px] text-white placeholder:text-white/[.5] focus:outline-none"
        />
        <button
          type="submit"
          aria-label="Enviar idea"
          disabled={loading || done || !input.trim()}
          className="h-11 w-11 flex-shrink-0 rounded-[13px] bg-grad text-lg font-extrabold text-white transition-transform duration-200 hover:scale-[1.08] disabled:opacity-50 disabled:hover:scale-100"
        >
          {loading ? '…' : '→'}
        </button>
      </form>

      {(history.length > 0 || error) && (
        <div className="mt-4 max-w-[470px] space-y-2 rounded-[16px] border border-white/10 bg-white/[.04] p-4 text-[14px]">
          {history.map((turn, i) => (
            <p key={i} className={turn.role === 'assistant' ? 'text-cian' : 'text-white/85'}>
              <span className="mr-1.5 font-bold">{turn.role === 'assistant' ? 'Opina IA:' : 'Tú:'}</span>
              {turn.text}
            </p>
          ))}
          {error && <p className="text-[#F2A0A0]">{error}</p>}
        </div>
      )}

      <p className="mt-4 max-w-[52ch] text-[12.5px] text-white/[.45]">
        Siempre declarada: te responde una IA. Aporta imparcialidad y soluciones contrastadas; las
        decisiones las toman siempre personas.
      </p>
    </div>
  );
}
