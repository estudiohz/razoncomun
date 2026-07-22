'use client';

import { useRef, useState } from 'react';

// Editor WYSIWYG "de verdad" (lo que ves es lo que hay), sin librería externa:
// un contentEditable + barra de botones que usa document.execCommand. Guarda el
// HTML en un <input hidden name="body_html"> que recoge la Server Action. Es el
// enfoque de peso cero, suficiente para páginas de texto (legales, estatutos):
// títulos, negrita, listas y enlaces. El HTML se sanea en el servidor al guardar.

const btn =
  'rounded-boton border border-linea px-2.5 py-1 text-[13px] font-bold text-titular hover:border-titular';

export function EditorWysiwyg({ inicial }: { inicial: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState(inicial ?? '');

  function sync() {
    if (ref.current) setHtml(ref.current.innerHTML);
  }
  function cmd(comando: string, valor?: string) {
    ref.current?.focus();
    document.execCommand(comando, false, valor);
    sync();
  }
  function enlace() {
    const url = window.prompt('Dirección del enlace (URL):', 'https://');
    if (url) cmd('createLink', url);
  }

  return (
    <section className="mb-6">
      <input type="hidden" name="body_html" value={html} />

      <div className="mb-2 flex flex-wrap gap-1.5">
        <button type="button" className={btn} title="Título" onClick={() => cmd('formatBlock', 'h2')}>
          Título
        </button>
        <button type="button" className={btn} title="Subtítulo" onClick={() => cmd('formatBlock', 'h3')}>
          Subtítulo
        </button>
        <button type="button" className={btn} title="Párrafo" onClick={() => cmd('formatBlock', 'p')}>
          Párrafo
        </button>
        <button type="button" className={btn} title="Negrita" onClick={() => cmd('bold')}>
          <strong>N</strong>
        </button>
        <button type="button" className={btn} title="Cursiva" onClick={() => cmd('italic')}>
          <em>C</em>
        </button>
        <button type="button" className={btn} title="Lista" onClick={() => cmd('insertUnorderedList')}>
          • Lista
        </button>
        <button type="button" className={btn} title="Lista numerada" onClick={() => cmd('insertOrderedList')}>
          1. Lista
        </button>
        <button type="button" className={btn} title="Enlace" onClick={enlace}>
          Enlace
        </button>
        <button type="button" className={btn} title="Quitar formato" onClick={() => cmd('removeFormat')}>
          Limpiar
        </button>
      </div>

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={sync}
        role="textbox"
        aria-multiline="true"
        aria-label="Cuerpo de la página"
        className="prose-rc min-h-[440px] rounded-boton border border-linea bg-white px-5 py-4 focus:border-titular focus:outline-none focus:ring-2 focus:ring-titular/20"
        // Contenido inicial. El div queda "no controlado" tras montar: React no
        // vuelve a tocar su innerHTML (inicial es constante), así que no pisa lo
        // que el usuario escribe; el estado `html` solo alimenta el input oculto.
        dangerouslySetInnerHTML={{ __html: inicial }}
      />
      <p className="mt-2 text-[12.5px] text-gris">
        Escribe con normalidad y da formato con los botones. Lo que ves aquí es como se verá en la
        web.
      </p>
    </section>
  );
}
