'use client';

import { useActionState, useEffect, useRef } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { editorAMarkdown, markdownAEditor } from '@/lib/blog/editorMarkdown';
import { subirMedia } from '@/lib/blog/admin';

/**
 * Editor visual del cuerpo. Escribe MARKDOWN hacia fuera: el estado del
 * formulario y lo que se guarda en la base de datos siguen siendo markdown,
 * así que el renderizador público y su escapado no cambian.
 *
 * Solo se usa cuando `roundTripSeguro()` dice que el documento sobrevive la
 * conversión — de eso se encarga quien lo monta (ver `FormularioArticulo`).
 */

const boton =
  'rounded px-2.5 py-1 text-[13px] font-bold text-cuerpo hover:bg-linea/60 disabled:opacity-40';
const botonActivo = 'bg-titular/10 text-titular';

export function EditorRico({
  valor,
  onChange,
}: {
  valor: string;
  onChange: (markdown: string) => void;
}) {
  const [subida, accionSubida, subiendo] = useActionState<
    { markdown?: string; url?: string; error?: string } | null,
    FormData
  >(subirMedia, null);

  // El contenido inicial se fija una sola vez: si se recalculara en cada
  // render, cada pulsación de tecla reiniciaría el editor y movería el cursor.
  const inicial = useRef(markdownAEditor(valor)).current;
  const ultimoInsertado = useRef<string | null>(null);

  const editor = useEditor({
    immediatelyRender: false, // evita el desajuste de hidratación en Next
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] }, // el renderizador solo pinta h2/h3
        codeBlock: false,
        horizontalRule: {},
      }),
      Link.configure({ openOnClick: false, autolink: false }),
      Image.configure({ inline: false }),
    ],
    content: inicial,
    editorProps: {
      attributes: {
        class: 'prose-rc min-h-[420px] px-5 py-4 focus:outline-none',
      },
    },
    onUpdate: ({ editor }) => onChange(editorAMarkdown(editor.getHTML())),
  });

  // Cuando termina una subida, intercala el markdown que compuso el servidor.
  useEffect(() => {
    if (!editor || !subida?.markdown) return;
    if (ultimoInsertado.current === subida.markdown) return;
    ultimoInsertado.current = subida.markdown;

    if (subida.markdown.startsWith('![')) {
      const url = /\(([^)]+)\)/.exec(subida.markdown)?.[1];
      if (url) editor.chain().focus().setImage({ src: url }).run();
    } else {
      // Vídeo y PDF no son nodos del editor: se insertan como párrafo con el
      // bloque `:::`, que el renderizador convierte al publicar. Se ve como
      // texto en el editor, y es honesto: es lo que se está guardando.
      editor.chain().focus().insertContent(`<p>${subida.markdown.replace(/\n/g, ' ')}</p>`).run();
    }
    onChange(editorAMarkdown(editor.getHTML()));
  }, [subida, editor, onChange]);

  if (!editor) {
    return (
      <div className="min-h-[420px] rounded-boton border border-linea bg-white px-5 py-4 text-gris">
        Cargando editor…
      </div>
    );
  }

  const b = (activo: boolean) => `${boton} ${activo ? botonActivo : ''}`;

  return (
    <div className="rounded-boton border border-linea bg-white">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-linea px-2 py-1.5">
        <button type="button" className={b(editor.isActive('bold'))}
          onClick={() => editor.chain().focus().toggleBold().run()} title="Negrita">
          <strong>B</strong>
        </button>
        <button type="button" className={b(editor.isActive('italic'))}
          onClick={() => editor.chain().focus().toggleItalic().run()} title="Cursiva">
          <em>I</em>
        </button>
        <span className="mx-1 h-5 w-px bg-linea" />
        <button type="button" className={b(editor.isActive('heading', { level: 2 }))}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          Título
        </button>
        <button type="button" className={b(editor.isActive('heading', { level: 3 }))}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          Subtítulo
        </button>
        <span className="mx-1 h-5 w-px bg-linea" />
        <button type="button" className={b(editor.isActive('bulletList'))}
          onClick={() => editor.chain().focus().toggleBulletList().run()}>
          Lista
        </button>
        <button type="button" className={b(editor.isActive('orderedList'))}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          1. Lista
        </button>
        <button type="button" className={b(editor.isActive('blockquote'))}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          Cita
        </button>
        <button type="button" className={boton}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          ———
        </button>
        <span className="mx-1 h-5 w-px bg-linea" />
        <button
          type="button"
          className={b(editor.isActive('link'))}
          onClick={() => {
            const previa = editor.getAttributes('link').href ?? '';
            const url = window.prompt('Dirección del enlace (deja vacío para quitarlo)', previa);
            if (url === null) return;
            if (!url) {
              editor.chain().focus().extendMarkRange('link').unsetLink().run();
              return;
            }
            if (!/^(https?:\/\/|\/|#|mailto:)/i.test(url)) {
              window.alert('Solo se admiten enlaces http(s), rutas del sitio, anclas o mailto.');
              return;
            }
            editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
          }}
        >
          Enlace
        </button>
      </div>

      <EditorContent editor={editor} />

      <div className="flex flex-wrap items-center gap-3 border-t border-linea px-4 py-2.5">
        {/* Formulario propio: va dentro del <form> del artículo, así que NO
            puede ser otro <form> anidado. Se usa formAction sobre el input. */}
        <label className="cursor-pointer text-[13px] font-bold text-titular">
          <input
            type="file"
            name="archivo"
            accept="image/jpeg,image/png,image/webp,image/avif,image/gif,video/mp4,video/webm,application/pdf"
            className="hidden"
            disabled={subiendo}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const fd = new FormData();
              fd.set('archivo', f);
              accionSubida(fd);
              e.target.value = '';
            }}
          />
          {subiendo ? 'Subiendo…' : '+ Insertar imagen, vídeo o PDF'}
        </label>
        <span className="text-[12.5px] text-gris">Hasta 50 MB.</span>
        {subida?.error ? (
          <span className="text-[12.5px] font-bold text-[#c0392b]">{subida.error}</span>
        ) : null}
      </div>
    </div>
  );
}
