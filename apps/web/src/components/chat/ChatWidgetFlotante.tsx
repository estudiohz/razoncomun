'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

/**
 * Widget flotante global (burbuja + panel) que reutiliza el mismo backend que
 * `/pregunta` (PreguntaChat.tsx -> /api/chat -> rc-brain-service). Comparte la
 * misma `sessionId` de sessionStorage para que sea la misma conversación esté
 * donde esté el usuario. No incluye simulador embebido ni el formulario de
 * "Complementa esta información" (PreguntaChat.tsx) — si una respuesta trae
 * algo más rico que texto, se enlaza a la página completa `/pregunta`.
 */

type Msg = {
  role: 'user' | 'assistant';
  text: string;
  sources?: { label: string }[];
  suggestions?: { label: string; query: string }[];
  related?: { label: string; query: string }[];
  tieneContenidoRico?: boolean;
};

function sessionId() {
  if (typeof window === 'undefined') return 'ssr';
  const key = 'rc-pregunta-session';
  let id = window.sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    window.sessionStorage.setItem(key, id);
  }
  return id;
}

export function ChatWidgetFlotante() {
  const [abierto, setAbierto] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const finRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (abierto) finRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, abierto, loading]);

  const enviar = async (texto: string) => {
    const text = texto.trim();
    if (!text || loading) return;
    setInput('');
    setError(null);
    setAviso(null);
    setMessages((m) => [...m, { role: 'user', text }]);
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId: sessionId() }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.rateLimited) {
          setAviso(
            data?.error ||
              'La IA está recibiendo muchas peticiones ahora mismo. Reinténtalo en unos segundos.',
          );
        } else {
          setError(data?.error || 'No se pudo contactar con el cerebro de Razón Común.');
        }
        return;
      }
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          text: data.answer,
          sources: data.sources,
          suggestions: data.suggestions,
          related: data.related,
          tieneContenidoRico: Boolean(
            (data.charts && data.charts.length > 0) || (data.embeds && data.embeds.length > 0),
          ),
        },
      ]);
    } catch {
      setError('No se pudo contactar con el cerebro de Razón Común. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void enviar(input);
  };

  return (
    <>
      {abierto && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Pregunta a Razón Común"
          className="fixed bottom-24 right-4 z-[70] flex h-[min(560px,75vh)] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-tarjeta border border-linea bg-noche shadow-tarjeta motion-safe:animate-sube sm:right-6"
        >
          <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <p className="text-[14px] font-bold text-white">Pregunta a Razón Común</p>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              aria-label="Cerrar chat"
              className="grid h-7 w-7 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
            >
              ✕
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <p className="text-[13.5px] text-white/[.55]">
                Pregúntame lo que quieras sobre el programa de Razón Común, por ejemplo: «¿qué
                proponéis para autónomos?».
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'assistant' ? 'text-white/90' : 'text-cian'}>
                <p className="whitespace-pre-wrap text-[13.5px]">
                  <span className="mr-1.5 font-bold">
                    {m.role === 'assistant' ? 'Razón Común IA:' : 'Tú:'}
                  </span>
                  {m.text}
                </p>

                {m.role === 'assistant' && m.tieneContenidoRico && (
                  <Link
                    href="/pregunta"
                    className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-cian hover:underline"
                  >
                    Ver gráfico/simulador en la página completa →
                  </Link>
                )}

                {m.role === 'assistant' && m.suggestions && m.suggestions.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1.5">
                    {m.suggestions.map((s, si) => (
                      <button
                        key={si}
                        type="button"
                        onClick={() => void enviar(s.query)}
                        disabled={loading}
                        className="flex items-center justify-between gap-2 rounded-[10px] border border-cian/30 bg-white/[.06] px-3 py-2 text-left text-[13px] text-white transition-colors hover:border-cian/60 hover:bg-white/[.1] disabled:opacity-50"
                      >
                        <span>{s.label}</span>
                        <span className="text-cian" aria-hidden>
                          →
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {m.role === 'assistant' && !m.suggestions && m.related && m.related.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1.5">
                    {m.related.map((r, ri) => (
                      <button
                        key={ri}
                        type="button"
                        onClick={() => void enviar(r.query)}
                        disabled={loading}
                        className="flex items-center justify-between gap-2 rounded-[10px] border border-white/15 bg-white/[.04] px-3 py-2 text-left text-[13px] text-white/85 transition-colors hover:border-white/40 hover:bg-white/[.08] disabled:opacity-50"
                      >
                        <span>{r.label}</span>
                        <span className="text-cian" aria-hidden>
                          →
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {loading && <p className="text-[12.5px] text-white/40">Consultando el programa de Razón Común…</p>}
            {aviso && (
              <p className="rounded-[10px] border border-[#F5C97B]/40 bg-[#F5C97B]/10 px-3 py-2 text-[12.5px] text-[#F5C97B]">
                {aviso}
              </p>
            )}
            {error && <p className="text-[12.5px] text-[#F2A0A0]">{error}</p>}
            <div ref={finRef} />
          </div>

          <form
            onSubmit={onSubmit}
            className="flex items-center gap-2 border-t border-white/10 p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu pregunta…"
              aria-label="Escribe tu pregunta"
              className="flex-1 rounded-[12px] border border-white/15 bg-white/[.06] px-3 py-2 text-[13.5px] text-white placeholder:text-white/[.5] focus:border-cian/60 focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Enviar pregunta"
              disabled={loading || !input.trim()}
              className="h-9 w-9 flex-shrink-0 rounded-[11px] bg-grad text-[15px] font-extrabold text-white transition-transform duration-200 hover:scale-[1.08] disabled:opacity-50 disabled:hover:scale-100"
            >
              {loading ? '…' : '→'}
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-label={abierto ? 'Cerrar chat de Razón Común' : 'Abrir chat de Razón Común'}
        aria-expanded={abierto}
        className="fixed bottom-4 right-4 z-[70] grid h-14 w-14 place-items-center rounded-full bg-grad text-white shadow-boton transition-transform hover:scale-[1.06] sm:bottom-6 sm:right-6"
      >
        {abierto ? (
          <span className="text-2xl leading-none">✕</span>
        ) : (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5v-8Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <circle cx="9" cy="9.5" r="1" fill="currentColor" />
            <circle cx="12.5" cy="9.5" r="1" fill="currentColor" />
            <circle cx="16" cy="9.5" r="1" fill="currentColor" />
          </svg>
        )}
      </button>
    </>
  );
}
