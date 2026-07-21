'use client';

import { useState } from 'react';
import { GraficoRC } from '@/components/brain/GraficoRC';
import type { GraficoSpec } from '@/lib/brain/tipos';

/**
 * "Pregunta a Razón Común" (docs/tecnico/rc-brain.md, fase 3): chat público
 * RAG estricto. Llama a /api/chat -> rc-brain-service /chat, que SOLO
 * responde con visibility='public' y cita sus fuentes SIEMPRE (o dice "no lo
 * sé" si no hay nada en el corpus). Este componente es tonto a propósito: no
 * decide nada de la constitución del cerebro, solo pinta lo que el servicio
 * ya decidió.
 */

type Msg = {
  role: 'user' | 'assistant';
  text: string;
  sources?: { label: string }[];
  charts?: GraficoSpec[];
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

export function PreguntaChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setError(null);
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
        setError(data?.error || 'No se pudo contactar con el cerebro de Razón Común.');
        return;
      }
      setMessages((m) => [
        ...m,
        { role: 'assistant', text: data.answer, sources: data.sources, charts: data.charts },
      ]);
    } catch {
      setError('No se pudo contactar con el cerebro de Razón Común. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4">
      <div className="min-h-[220px] space-y-4 rounded-[16px] border border-white/10 bg-white/[.04] p-5">
        {messages.length === 0 && (
          <p className="text-[14px] text-white/[.55]">
            Pregúntame lo que quieras sobre el programa de Razón Común, por ejemplo: «¿qué
            proponéis para autónomos?» o «¿qué dice el punto 15 de vivienda?».
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'assistant' ? 'text-white/90' : 'text-cian'}>
            <p className="whitespace-pre-wrap text-[14.5px]">
              <span className="mr-1.5 font-bold">{m.role === 'assistant' ? 'Razón Común IA:' : 'Tú:'}</span>
              {m.text}
            </p>
            {m.role === 'assistant' && m.charts && m.charts.length > 0 && (
              <div className="mt-3 space-y-3">
                {m.charts.map((c, ci) => (
                  <GraficoRC key={ci} spec={c} />
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && <p className="text-[13px] text-white/40">Consultando el corpus público…</p>}
        {error && <p className="text-[13px] text-[#F2A0A0]">{error}</p>}
      </div>

      <form
        onSubmit={onSubmit}
        className="flex items-center gap-3 rounded-[18px] border border-cian/30 bg-white/[.06] py-2 pl-[22px] pr-2 backdrop-blur-[6px]"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe tu pregunta sobre el programa…"
          aria-label="Escribe tu pregunta"
          className="flex-1 bg-transparent text-[15px] text-white placeholder:text-white/[.5] focus:outline-none"
        />
        <button
          type="submit"
          aria-label="Enviar pregunta"
          disabled={loading || !input.trim()}
          className="h-11 w-11 flex-shrink-0 rounded-[13px] bg-grad text-lg font-extrabold text-white transition-transform duration-200 hover:scale-[1.08] disabled:opacity-50 disabled:hover:scale-100"
        >
          {loading ? '…' : '→'}
        </button>
      </form>
    </div>
  );
}
