'use client';

import { useRef, useState } from 'react';
import { Input } from '@/components/ui/Input';

// Editor del SIMULADOR HTML adjunto a una entrada del cerebro (0027).
//
// El admin pulsa "Examinar", elige un fichero .html autocontenido (p. ej. el
// simulador de viabilidad que generamos), y se guarda VERBATIM en la columna
// embed_html vía <input hidden>. La previsualización usa un <iframe sandbox>
// (sin allow-same-origin): el JS del simulador corre en origen opaco, no toca
// la sesión ni el DOM de la app -- misma garantía con la que luego se sirve al
// ciudadano en /api/cerebro/embed/[id]. El HTML NO se indexa en el RAG: es un
// extra visual. Ver docs/tecnico/cerebro-participativo.md (pieza A).

const LIMITE_BYTES = 256 * 1024;

const etiqueta = 'mb-1 block text-[12px] font-bold uppercase tracking-[.06em] text-gris';

function tamanoLegible(texto: string): string {
  const kb = new Blob([texto]).size / 1024;
  return kb < 1 ? `${Math.round(kb * 1024)} B` : `${kb.toFixed(1)} KB`;
}

export function EditorSimulador({
  htmlInicial,
  tituloInicial,
}: {
  htmlInicial: string | null;
  tituloInicial: string | null;
}) {
  const [html, setHtml] = useState(htmlInicial ?? '');
  const [titulo, setTitulo] = useState(tituloInicial ?? '');
  const [error, setError] = useState<string | null>(null);
  const [previsualizar, setPrevisualizar] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function onFichero(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/\.html?$/i.test(file.name) && file.type !== 'text/html') {
      setError('Elige un fichero .html');
      return;
    }
    if (file.size > LIMITE_BYTES) {
      setError(`El fichero pesa ${(file.size / 1024).toFixed(0)} KB; el límite es 256 KB.`);
      return;
    }
    const lector = new FileReader();
    lector.onload = () => {
      const contenido = String(lector.result ?? '');
      setHtml(contenido);
      if (!titulo.trim()) setTitulo('Simulador');
      setPrevisualizar(true);
    };
    lector.onerror = () => setError('No se ha podido leer el fichero.');
    lector.readAsText(file);
  }

  function quitar() {
    setHtml('');
    setTitulo('');
    setPrevisualizar(false);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  const hayHtml = html.trim().length > 0;

  return (
    <section className="mb-6 rounded-tarjeta border border-linea bg-white p-5">
      {/* Campos que recoge la Server Action guardarEntrada (form="entrada"). */}
      <input type="hidden" name="embed_html" value={html} form="entrada" />
      <input type="hidden" name="embed_title" value={titulo} form="entrada" />

      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[13px] font-bold uppercase tracking-[.08em] text-gris">
          Simulador (opcional)
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-full border border-linea px-4 py-1.5 text-[13px] font-bold text-titular hover:border-titular"
          >
            Examinar…
          </button>
          {hayHtml && (
            <button
              type="button"
              onClick={() => setPrevisualizar((v) => !v)}
              className="rounded-full border border-linea px-4 py-1.5 text-[13px] font-bold text-titular hover:border-titular"
            >
              {previsualizar ? 'Ocultar' : 'Previsualizar'}
            </button>
          )}
        </div>
      </div>
      <p className="mb-3 text-[12.5px] leading-relaxed text-gris">
        Sube un HTML autocontenido (gráficos o simuladores interactivos). Cuando el chat use esta
        entrada, ofrecerá al ciudadano un botón para abrirlo. No se indexa en el cerebro: es un extra
        visual, la IA responde igualmente con el texto.
      </p>

      {/* input de fichero oculto: el botón "Examinar…" lo dispara */}
      <input
        ref={inputRef}
        type="file"
        accept="text/html,.html,.htm"
        onChange={onFichero}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
      />

      {error && (
        <p className="mb-3 rounded-boton border border-red-300 bg-red-50 px-3 py-2 text-[13px] text-red-600">
          {error}
        </p>
      )}

      {!hayHtml ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full rounded-boton border border-dashed border-linea bg-fondo px-4 py-6 text-center text-[13px] text-gris hover:border-titular hover:text-titular"
        >
          Sin simulador. Pulsa para elegir un fichero <strong>.html</strong> (máx. 256 KB).
        </button>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-3 rounded-boton border border-linea bg-fondo px-3 py-2 text-[13px] text-cuerpo">
            <span className="font-bold text-titular">HTML cargado</span>
            <span className="text-gris">{tamanoLegible(html)}</span>
            <button
              type="button"
              onClick={quitar}
              className="ml-auto rounded-boton border border-red-300 px-3 py-1 text-[12.5px] font-bold text-red-600 hover:bg-red-50"
            >
              Quitar
            </button>
          </div>

          <div className="mb-3">
            <label className={etiqueta} htmlFor="embed_title_visible">
              Título del botón en el chat
            </label>
            <Input
              id="embed_title_visible"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Simulador de viabilidad"
              maxLength={120}
            />
          </div>

          {previsualizar && (
            <div>
              <p className="mb-2 text-[11.5px] font-bold uppercase tracking-[.06em] text-gris">
                Vista previa (aislada en sandbox)
              </p>
              <iframe
                title="Vista previa del simulador"
                sandbox="allow-scripts"
                srcDoc={html}
                className="h-[520px] w-full rounded-boton border border-linea bg-white"
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}
