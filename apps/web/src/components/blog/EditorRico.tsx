'use client';

import { useActionState, useEffect, useRef } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import TextAlign from '@tiptap/extension-text-align';
import { Color, FontFamily, TextStyle } from '@tiptap/extension-text-style';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import { subirMedia } from '@/lib/blog/admin';

/**
 * Editor visual del cuerpo. Trabaja y devuelve **HTML** (migración 0049).
 *
 * Antes serializaba a markdown y hacía falta toda una maquinaria de ida y
 * vuelta con red de seguridad, porque markdown no puede expresar color,
 * fuente, alineación ni subrayado. Al guardar HTML ese problema desaparece:
 * lo que el editor muestra es lo que se guarda.
 *
 * La seguridad NO depende de este componente: el HTML se sanea en el servidor
 * al renderizar (`lib/blog/html.ts`, `prepararCuerpo`). Aquí no hay nada en lo
 * que confiar.
 */

const boton =
  'rounded px-2 py-1 text-[13px] font-bold text-cuerpo hover:bg-linea/60 disabled:opacity-40';
const activo = 'bg-titular/10 text-titular';
const sep = <span className="mx-1 h-5 w-px bg-linea" />;

const COLORES = ['#1B3D9C', '#8B30D9', '#C3369E', '#E8792F', '#16B8A0', '#2BC7E8', '#333333'];

export function EditorRico({
  valor,
  onChange,
}: {
  valor: string;
  onChange: (html: string) => void;
}) {
  const [subida, accionSubida, subiendo] = useActionState<
    { markdown?: string; html?: string; url?: string; error?: string } | null,
    FormData
  >(subirMedia, null);

  // Contenido inicial fijado una sola vez: recalcularlo en cada render
  // reiniciaría el editor y movería el cursor en cada tecla.
  const inicial = useRef(valor).current;
  const ultimo = useRef<string | null>(null);

  const editor = useEditor({
    immediatelyRender: false, // evita el desajuste de hidratación en Next
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: { openOnClick: false, autolink: false },
      }),
      Underline,
      Highlight.configure({ multicolor: true }),
      Subscript,
      Superscript,
      TextStyle,
      Color,
      FontFamily,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Image.configure({ inline: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: inicial,
    editorProps: {
      attributes: { class: 'prose-rc min-h-[420px] px-5 py-4 focus:outline-none' },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Al terminar una subida, inserta el nodo correspondiente.
  useEffect(() => {
    if (!editor || !subida?.url) return;
    if (ultimo.current === subida.url) return;
    ultimo.current = subida.url;
    const url = subida.url;

    if (/\.(jpe?g|png|webp|avif|gif)$/i.test(url)) {
      editor.chain().focus().setImage({ src: url }).run();
    } else if (/\.(mp4|webm)$/i.test(url)) {
      // El vídeo no es un nodo del editor: se inserta el HTML directamente.
      // El saneador del servidor permite <video controls preload>.
      editor
        .chain()
        .focus()
        .insertContent(`<video src="${url}" controls preload="metadata"></video>`)
        .run();
    } else {
      editor
        .chain()
        .focus()
        .insertContent(`<p><a href="${url}">Descargar documento (PDF)</a></p>`)
        .run();
    }
    onChange(editor.getHTML());
  }, [subida, editor, onChange]);

  if (!editor) {
    return (
      <div className="min-h-[420px] rounded-boton border border-linea bg-white px-5 py-4 text-gris">
        Cargando editor…
      </div>
    );
  }

  const b = (act: boolean) => `${boton} ${act ? activo : ''}`;

  return (
    <div className="rounded-boton border border-linea bg-white">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-linea px-2 py-1.5">
        <button type="button" className={boton} title="Deshacer"
          onClick={() => editor.chain().focus().undo().run()}>↶</button>
        <button type="button" className={boton} title="Rehacer"
          onClick={() => editor.chain().focus().redo().run()}>↷</button>
        {sep}

        <button type="button" className={b(editor.isActive('bold'))} title="Negrita"
          onClick={() => editor.chain().focus().toggleBold().run()}><strong>B</strong></button>
        <button type="button" className={b(editor.isActive('italic'))} title="Cursiva"
          onClick={() => editor.chain().focus().toggleItalic().run()}><em>I</em></button>
        <button type="button" className={b(editor.isActive('underline'))} title="Subrayado"
          onClick={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></button>
        <button type="button" className={b(editor.isActive('strike'))} title="Tachado"
          onClick={() => editor.chain().focus().toggleStrike().run()}><s>S</s></button>
        <button type="button" className={b(editor.isActive('highlight'))} title="Resaltar"
          onClick={() => editor.chain().focus().toggleHighlight().run()}>🖍</button>
        <button type="button" className={b(editor.isActive('subscript'))} title="Subíndice"
          onClick={() => editor.chain().focus().toggleSubscript().run()}>X₂</button>
        <button type="button" className={b(editor.isActive('superscript'))} title="Superíndice"
          onClick={() => editor.chain().focus().toggleSuperscript().run()}>X²</button>
        <button type="button" className={b(editor.isActive('code'))} title="Código"
          onClick={() => editor.chain().focus().toggleCode().run()}>{'</>'}</button>
        {sep}

        <select
          className="rounded border border-linea px-1.5 py-1 text-[13px] text-cuerpo"
          title="Estilo de párrafo"
          value={
            editor.isActive('heading', { level: 2 }) ? 'h2'
              : editor.isActive('heading', { level: 3 }) ? 'h3'
              : editor.isActive('heading', { level: 4 }) ? 'h4'
              : 'p'
          }
          onChange={(e) => {
            const v = e.target.value;
            if (v === 'p') editor.chain().focus().setParagraph().run();
            else editor.chain().focus().toggleHeading({ level: Number(v[1]) as 2 | 3 | 4 }).run();
          }}
        >
          <option value="p">Párrafo</option>
          <option value="h2">Título</option>
          <option value="h3">Subtítulo</option>
          <option value="h4">Apartado</option>
        </select>

        <select
          className="rounded border border-linea px-1.5 py-1 text-[13px] text-cuerpo"
          title="Tipo de letra"
          value={editor.getAttributes('textStyle').fontFamily ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) editor.chain().focus().unsetFontFamily().run();
            else editor.chain().focus().setFontFamily(v).run();
          }}
        >
          <option value="">Fuente</option>
          <option value="Montserrat">Montserrat</option>
          <option value="Georgia, serif">Georgia</option>
          <option value="system-ui, sans-serif">Sistema</option>
          <option value="monospace">Monoespaciada</option>
        </select>

        <span className="ml-1 flex items-center gap-0.5" title="Color del texto">
          {COLORES.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Color ${c}`}
              className="h-4 w-4 rounded-full border border-linea"
              style={{ backgroundColor: c }}
              onClick={() => editor.chain().focus().setColor(c).run()}
            />
          ))}
          <button type="button" className={boton} title="Quitar color"
            onClick={() => editor.chain().focus().unsetColor().run()}>✕</button>
        </span>
        {sep}

        <button type="button" className={b(editor.isActive('bulletList'))} title="Lista"
          onClick={() => editor.chain().focus().toggleBulletList().run()}>•—</button>
        <button type="button" className={b(editor.isActive('orderedList'))} title="Lista numerada"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}>1—</button>
        <button type="button" className={b(editor.isActive('blockquote'))} title="Cita"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}>❝</button>
        <button type="button" className={boton} title="Línea separadora"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}>———</button>
        {sep}

        {(['left', 'center', 'right', 'justify'] as const).map((a) => (
          <button key={a} type="button" className={b(editor.isActive({ textAlign: a }))}
            title={`Alinear a ${a}`}
            onClick={() => editor.chain().focus().setTextAlign(a).run()}>
            {a === 'left' ? '⇤' : a === 'center' ? '↔' : a === 'right' ? '⇥' : '≡'}
          </button>
        ))}
        {sep}

        <button type="button" className={boton} title="Insertar tabla"
          onClick={() =>
            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
          }>
          ▦
        </button>
        {editor.isActive('table') ? (
          <>
            <button type="button" className={boton} title="Añadir columna"
              onClick={() => editor.chain().focus().addColumnAfter().run()}>+col</button>
            <button type="button" className={boton} title="Añadir fila"
              onClick={() => editor.chain().focus().addRowAfter().run()}>+fila</button>
            <button type="button" className={boton} title="Borrar tabla"
              onClick={() => editor.chain().focus().deleteTable().run()}>✕tabla</button>
          </>
        ) : null}
        {sep}

        <button
          type="button"
          className={b(editor.isActive('link'))}
          title="Enlace"
          onClick={() => {
            const previa = editor.getAttributes('link').href ?? '';
            const url = window.prompt('Dirección del enlace (vacío para quitarlo)', previa);
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
          🔗
        </button>

        {/* No puede ser un <form> propio: vive dentro del <form> del artículo y
            anidarlos es HTML inválido. Se dispara la acción desde onChange. */}
        <label
          className={`cursor-pointer rounded px-2 py-1 text-[13px] font-bold text-titular hover:bg-linea/60 ${
            subiendo ? 'pointer-events-none opacity-50' : ''
          }`}
          title="Insertar imagen, vídeo o PDF (hasta 50 MB)"
        >
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
          {subiendo ? 'Subiendo…' : '+ Imagen / Vídeo / PDF'}
        </label>
      </div>

      {subida?.error ? (
        <p className="border-b border-linea bg-[#c0392b]/5 px-4 py-2 text-[12.5px] font-bold text-[#c0392b]">
          {subida.error}
        </p>
      ) : null}

      <EditorContent editor={editor} />
    </div>
  );
}
