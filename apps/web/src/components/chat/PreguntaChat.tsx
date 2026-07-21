'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { GraficoRC } from '@/components/brain/GraficoRC';
import type { GraficoSpec } from '@/lib/brain/tipos';

/**
 * "Pregunta a Razón Común" (docs/tecnico/rc-brain.md, fase 3): chat público
 * RAG estricto. Llama a /api/chat -> rc-brain-service /chat, que SOLO responde
 * con visibility='public' y cita sus fuentes SIEMPRE. Este componente pinta lo
 * que el servicio ya decidió y añade dos acciones por respuesta
 * (cerebro-participativo.md): abrir un simulador adjunto en un panel lateral
 * (pieza A) y "Complementa esta información" (pieza B).
 */

type Embed = { entryId: string; title: string };

type Msg = {
  role: 'user' | 'assistant';
  text: string;
  sources?: { label: string }[];
  charts?: GraficoSpec[];
  embeds?: Embed[];
  suggestions?: { label: string; query: string }[];
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

export function PreguntaChat({ autenticado }: { autenticado: boolean }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [simulador, setSimulador] = useState<Embed | null>(null);
  // Índice del mensaje cuyo formulario "Complementar" está abierto (o null).
  const [complementando, setComplementando] = useState<number | null>(null);

  const enviar = async (texto: string) => {
    const text = texto.trim();
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
        {
          role: 'assistant',
          text: data.answer,
          sources: data.sources,
          charts: data.charts,
          embeds: data.embeds,
          suggestions: data.suggestions,
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

  // La pregunta que originó el mensaje `i` (el mensaje de usuario anterior).
  const preguntaDe = (i: number): string => {
    for (let j = i - 1; j >= 0; j--) if (messages[j].role === 'user') return messages[j].text;
    return '';
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

            {m.role === 'assistant' && m.suggestions && m.suggestions.length > 0 && (
              <div className="mt-3 flex flex-col gap-2">
                {m.suggestions.map((s, si) => (
                  <button
                    key={si}
                    type="button"
                    onClick={() => void enviar(s.query)}
                    disabled={loading}
                    className="flex items-center justify-between gap-2 rounded-[12px] border border-cian/30 bg-white/[.06] px-4 py-2.5 text-left text-[14px] text-white transition-colors hover:border-cian/60 hover:bg-white/[.1] disabled:opacity-50"
                  >
                    <span>{s.label}</span>
                    <span className="text-cian" aria-hidden>
                      →
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Acciones de la respuesta: ver simulador + complementar */}
            {m.role === 'assistant' && !m.suggestions && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {m.embeds?.map((e) => (
                  <button
                    key={e.entryId}
                    type="button"
                    onClick={() => setSimulador(e)}
                    className="inline-flex items-center gap-2 rounded-full border border-cian/40 bg-cian/10 px-4 py-2 text-[13.5px] font-bold text-[#7FE3F2] transition-colors hover:bg-cian/20"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M4 15l5-5 4 4 7-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    ¿Quieres ver el simulador que hemos preparado?
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setComplementando((c) => (c === i ? null : i))}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3.5 py-2 text-[13px] font-semibold text-white/70 transition-colors hover:border-white/40 hover:text-white"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Complementa esta información
                </button>
              </div>
            )}

            {/* Formulario / CTA de contribución */}
            {complementando === i && (
              <Complementar
                autenticado={autenticado}
                pregunta={preguntaDe(i)}
                respuesta={m.text}
                sources={m.sources}
                relatedEntryId={m.embeds?.[0]?.entryId ?? null}
                onCerrar={() => setComplementando(null)}
              />
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

      {simulador && <PanelSimulador embed={simulador} onCerrar={() => setSimulador(null)} />}
    </div>
  );
}

/** Panel lateral (tipo artifacts): iframe sandbox con el simulador de la entrada. */
function PanelSimulador({ embed, onCerrar }: { embed: Embed; onCerrar: () => void }) {
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  // Esc cierra; bloquea el scroll del fondo mientras está abierto.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onCerrar]);

  if (!montado) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex justify-end" role="dialog" aria-modal="true" aria-label={embed.title}>
      <div className="absolute inset-0 bg-noche/50" onClick={onCerrar} aria-hidden />
      <aside
        role="complementary"
        className="relative flex h-full w-full max-w-[620px] flex-col border-l border-linea bg-white shadow-nav motion-safe:animate-[entra_.28s_cubic-bezier(.16,1,.3,1)]"
      >
        <header className="flex items-center justify-between gap-3 border-b border-linea px-5 py-3.5">
          <h2 className="truncate text-[15px] font-bold text-titular">{embed.title}</h2>
          <div className="flex items-center gap-2">
            <a
              href={`/api/cerebro/embed/${embed.entryId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-boton border border-linea px-3 py-1.5 text-[12.5px] font-semibold text-gris hover:border-titular hover:text-titular"
            >
              Abrir en pestaña
            </a>
            <button
              type="button"
              onClick={onCerrar}
              aria-label="Cerrar simulador"
              className="grid h-8 w-8 place-items-center rounded-full text-gris hover:bg-fondo hover:text-titular"
            >
              ✕
            </button>
          </div>
        </header>
        <iframe
          title={embed.title}
          src={`/api/cerebro/embed/${embed.entryId}`}
          sandbox="allow-scripts"
          className="h-full w-full flex-1 border-0 bg-white"
        />
      </aside>
    </div>,
    document.body,
  );
}

/** Formulario de contribución (registrados) o CTA de registro (anónimos). */
function Complementar({
  autenticado,
  pregunta,
  respuesta,
  sources,
  relatedEntryId,
  onCerrar,
}: {
  autenticado: boolean;
  pregunta: string;
  respuesta: string;
  sources?: { label: string }[];
  relatedEntryId: string | null;
  onCerrar: () => void;
}) {
  const [body, setBody] = useState('');
  const [claimedWrong, setClaimedWrong] = useState('');
  const [claimedRight, setClaimedRight] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [necesitaRegistro, setNecesitaRegistro] = useState(!autenticado);

  const enviar = async () => {
    if (!body.trim() || enviando) return;
    setEnviando(true);
    setErrorForm(null);
    try {
      const res = await fetch('/api/cerebro/contribuciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: body.trim(),
          claimedWrong: claimedWrong.trim() || undefined,
          claimedRight: claimedRight.trim() || undefined,
          sourceUrl: sourceUrl.trim() || undefined,
          relatedEntryId,
          sessionId: sessionId(),
          turn: { pregunta, respuesta, sources: sources?.map((s) => s.label) ?? [] },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 && data?.needsAuth) {
        setNecesitaRegistro(true);
        return;
      }
      if (!res.ok) {
        setErrorForm(data?.error || 'No se ha podido enviar. Inténtalo de nuevo.');
        return;
      }
      setEnviado(true);
    } catch {
      setErrorForm('No se ha podido enviar (error de red). Inténtalo de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  const caja = 'rounded-[12px] border border-white/10 bg-white/[.05] p-4';
  const campo =
    'w-full rounded-[10px] border border-white/15 bg-white/[.06] px-3 py-2 text-[14px] text-white placeholder:text-white/40 focus:border-cian/60 focus:outline-none';

  if (necesitaRegistro) {
    return (
      <div className={`mt-3 ${caja}`}>
        <p className="text-[14px] font-bold text-white">¿Quieres aportar a Razón Común?</p>
        <p className="mt-1 text-[13px] text-white/70">
          Regístrate para complementar o corregir esta información. Un editor la revisará antes de
          que entre en el cerebro.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/registro"
            className="rounded-full bg-grad px-4 py-2 text-[13.5px] font-bold text-white hover:scale-[1.03]"
          >
            Regístrate
          </Link>
          <Link
            href="/entrar?next=/pregunta"
            className="rounded-full border border-white/20 px-4 py-2 text-[13.5px] font-semibold text-white/80 hover:border-white/40 hover:text-white"
          >
            Ya tengo cuenta
          </Link>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-full px-3 py-2 text-[13px] text-white/50 hover:text-white/80"
          >
            Ahora no
          </button>
        </div>
      </div>
    );
  }

  if (enviado) {
    return (
      <div className={`mt-3 ${caja}`}>
        <p className="text-[14px] font-bold text-[#7FE3F2]">¡Gracias por tu aportación!</p>
        <p className="mt-1 text-[13px] text-white/70">
          Un editor la revisará. Si aporta un dato contrastado, mejorará lo que responde el cerebro.
        </p>
        <button
          type="button"
          onClick={onCerrar}
          className="mt-3 rounded-full border border-white/20 px-4 py-1.5 text-[13px] font-semibold text-white/80 hover:border-white/40 hover:text-white"
        >
          Cerrar
        </button>
      </div>
    );
  }

  return (
    <div className={`mt-3 ${caja}`}>
      <p className="mb-2 text-[13.5px] font-bold text-white">Complementa o corrige esta respuesta</p>
      <div className="flex flex-col gap-2.5">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={4000}
          placeholder="¿Qué añadirías o corregirías? Aporta el detalle o el dato que conozcas."
          className={campo}
        />
        <div className="grid gap-2.5 min-[560px]:grid-cols-2">
          <input
            value={claimedWrong}
            onChange={(e) => setClaimedWrong(e.target.value)}
            placeholder="Dato que crees erróneo (opcional)"
            className={campo}
            maxLength={500}
          />
          <input
            value={claimedRight}
            onChange={(e) => setClaimedRight(e.target.value)}
            placeholder="Valor correcto (opcional)"
            className={campo}
            maxLength={500}
          />
        </div>
        <input
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          placeholder="Fuente / enlace (opcional)"
          className={campo}
          maxLength={500}
          inputMode="url"
        />
        {errorForm && <p className="text-[12.5px] text-[#F2A0A0]">{errorForm}</p>}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void enviar()}
            disabled={enviando || !body.trim()}
            className="rounded-full bg-grad px-5 py-2 text-[13.5px] font-bold text-white transition-transform hover:scale-[1.03] disabled:opacity-50 disabled:hover:scale-100"
          >
            {enviando ? 'Enviando…' : 'Enviar aportación'}
          </button>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-full px-3 py-2 text-[13px] text-white/50 hover:text-white/80"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
