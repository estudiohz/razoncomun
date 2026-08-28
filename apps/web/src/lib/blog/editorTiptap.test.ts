// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { editorAMarkdown, markdownAEditor } from './editorMarkdown';

/**
 * Ida y vuelta REAL, pasando por TipTap.
 *
 * `editorMarkdown.test.ts` prueba solo mis conversores; este pasa por el
 * editor de verdad. La diferencia importa: TipTap normaliza el HTML contra su
 * esquema y **descarta lo que no encaja**. Un `<img>` dentro de `<p>` con la
 * extensión Image en modo bloque se pierde en silencio — y son 7 los artículos
 * reales con imágenes. Este fichero existe para que eso no vuelva a colarse.
 */

function porTiptap(markdown: string): string {
  const editor = new Editor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: false,
        link: { openOnClick: false, autolink: false },
      }),
      Image.configure({ inline: false }),
    ],
    content: markdownAEditor(markdown),
  });
  const salida = editorAMarkdown(editor.getHTML());
  editor.destroy();
  return salida.trim();
}

describe('ida y vuelta a través de TipTap', () => {
  const casos: [string, string][] = [
    ['encabezados', '## Vivienda\n\n### Medidas'],
    ['párrafo con negrita', 'El **problema** es claro.'],
    ['cursiva', 'Texto en *cursiva*.'],
    ['enlace', 'Ver el [programa](https://razoncomun.com/programa).'],
    ['lista', '- Uno\n- Dos'],
    ['lista numerada', '1. Uno\n2. Dos'],
    ['cita', '> Una cita.'],
    ['regla', '---'],
  ];

  for (const [nombre, md] of casos) {
    it(nombre, () => expect(porTiptap(md)).toBe(md));
  }

  it('CONSERVA las imágenes (7 artículos reales dependen de esto)', () => {
    const md = '![Congreso](https://api.razoncomun.com/i/congreso.webp)';
    expect(porTiptap(md)).toBe(md);
  });

  it('conserva una imagen intercalada entre párrafos', () => {
    const md = 'Antes.\n\n![Foto](https://x.com/a.jpg)\n\nDespués.';
    expect(porTiptap(md)).toBe(md);
  });

  it('conserva un documento completo con imagen, lista y cita', () => {
    const md =
      '## Vivienda\n\nEl **problema**.\n\n![Gráfico](https://x.com/g.png)\n\n- Uno\n- Dos\n\n> Cita final.';
    expect(porTiptap(md)).toBe(md);
  });
});
