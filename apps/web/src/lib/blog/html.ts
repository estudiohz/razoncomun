import sanitizeHtml from 'sanitize-html';
import type { EntradaIndice } from './tipos';

/**
 * Saneado y utilidades del contenido en HTML.
 *
 * ⚠️ POR QUÉ ESTE FICHERO ES CRÍTICO
 *
 * Hasta ahora el cuerpo se guardaba en markdown y `markdown.ts` **escapaba
 * todo** antes de aplicar formato: aunque la cuenta de un editor se viera
 * comprometida, no podía inyectar HTML ejecutable. Al pasar a guardar HTML
 * (decisión de Sergio, 28/08/2026, para tener un editor tipo WordPress) esa
 * garantía desaparece y la sustituye ESTE saneado.
 *
 * Reglas que no se negocian:
 *  1. Lista BLANCA de etiquetas y atributos. Nunca lista negra: lo que no está
 *     explícitamente permitido, fuera.
 *  2. Se sanea **al RENDERIZAR**, no solo al guardar. Si solo se saneara al
 *     guardar, cualquier fila que entrara por otra vía (importación, SQL a
 *     mano, un bug futuro) llegaría intacta al navegador.
 *  3. Sin `style` libre: solo se permiten unas pocas propiedades y con valores
 *     validados por expresión regular. `style` es un vector de ataque real
 *     (`expression()`, `url(javascript:)`, exfiltración por `background`).
 *  4. Sin `<script>`, `<iframe>`, `<object>`, `<embed>`, `<form>`, ni ningún
 *     atributo `on*`.
 */

/** Colores admitidos: hex de 3/6 dígitos y rgb()/rgba(). Nada de url() ni funciones. */
const COLOR = [/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\)$/];

const OPCIONES: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'hr',
    'h2', 'h3', 'h4',
    'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del', 'mark',
    'sub', 'sup', 'code', 'pre', 'blockquote',
    'ul', 'ol', 'li',
    'a', 'img', 'figure', 'figcaption', 'video', 'source',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'span', 'div',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    video: ['src', 'controls', 'preload', 'poster', 'width', 'height'],
    source: ['src', 'type'],
    th: ['colspan', 'rowspan', 'scope'],
    td: ['colspan', 'rowspan'],
    h2: ['id'],
    h3: ['id'],
    h4: ['id'],
    // `class` solo en los contenedores donde el renderizador pone las suyas
    // (rc-dato, rc-video, rc-pdf) y para la alineación del editor.
    p: ['class', 'style'],
    div: ['class'],
    figure: ['class'],
    span: ['class', 'style'],
    li: ['class'],
    table: ['class'],
  },
  // Solo estas propiedades, y con valores validados. Sin `style` libre.
  allowedStyles: {
    '*': {
      color: COLOR,
      'background-color': COLOR,
      'text-align': [/^(left|right|center|justify)$/],
      'font-size': [/^\d{1,2}(?:\.\d+)?(?:px|pt|em|rem)$/],
      'font-family': [/^[\w\s,'"-]{1,80}$/],
    },
  },
  // Protocolos: nada de javascript:, data: ni vbscript:.
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['http', 'https'], video: ['http', 'https'], source: ['http', 'https'] },
  allowProtocolRelative: false,
  // Todo enlace externo sale con rel de seguridad: sin esto, `target="_blank"`
  // da acceso a `window.opener` a la página destino (tabnabbing).
  transformTags: {
    a: (nombre, attribs) => {
      const href = attribs.href ?? '';
      const externo = /^https?:\/\//i.test(href);
      return {
        tagName: 'a',
        attribs: {
          ...attribs,
          ...(externo ? { target: '_blank', rel: 'noopener noreferrer' } : {}),
        },
      };
    },
  },
  // Etiquetas vacías que no aportan nada se eliminan, salvo las que son
  // significativas por sí mismas.
  nonTextTags: ['style', 'script', 'textarea', 'option', 'noscript'],
};

/**
 * Sanea HTML de contenido. **Llamar SIEMPRE justo antes de renderizar**, no
 * solo al guardar.
 */
export function sanearHtml(html: string): string {
  if (!html) return '';
  return sanitizeHtml(html, OPCIONES);
}

/** Slug estable para los `id` de encabezado. Mismo algoritmo que `markdown.ts`. */
export function slugificar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Extrae el índice (h2/h3) y les pone `id`, para el sidebar de la ficha.
 *
 * Equivale a lo que hacía `renderizarMarkdown`, que devolvía html + índice de
 * una pasada. Aquí se hace sobre el HTML ya saneado, con expresión regular en
 * vez de un DOM: esto corre en el servidor en cada render y montar un DOM
 * completo por artículo sería caro para lo poco que hace falta.
 */
export function prepararHtml(html: string): { html: string; indice: EntradaIndice[] } {
  const limpio = sanearHtml(html);
  const indice: EntradaIndice[] = [];
  const vistos = new Map<string, number>();

  const conIds = limpio.replace(
    /<(h2|h3)([^>]*)>([\s\S]*?)<\/\1>/g,
    (_m, etiqueta: string, attrs: string, dentro: string) => {
      const texto = dentro.replace(/<[^>]+>/g, '').trim();
      const raiz = slugificar(texto) || 'seccion';
      const n = vistos.get(raiz) ?? 0;
      vistos.set(raiz, n + 1);
      const id = n === 0 ? raiz : `${raiz}-${n + 1}`;
      indice.push({ id, texto, nivel: etiqueta === 'h2' ? 2 : 3 });
      const sinId = attrs.replace(/\sid="[^"]*"/g, '');
      return `<${etiqueta}${sinId} id="${id}">${dentro}</${etiqueta}>`;
    },
  );

  return { html: conIds, indice };
}
