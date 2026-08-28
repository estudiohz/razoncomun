import { sanearHtml } from './blog/html';
import { slugificar } from '@/lib/blog/markdown';

/** Fila de `public.pages` (0028) — el mini-CMS de páginas estáticas. */
export interface Pagina {
  id: string;
  slug: string;
  title: string;
  body_html: string;
  show_header: boolean;
  show_footer: boolean;
  show_legal: boolean;
  position: number;
  published: boolean;
  author_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Enlace de menú derivado de una página (para header/footer/legal). */
export interface EnlacePagina {
  slug: string;
  title: string;
  position: number;
}

export { slugificar };

/**
 * Saneado del HTML del editor WYSIWYG antes de guardarlo. El contenido es de
 * autoría de editores (rol is_editor + 2FA), pero se sirve a TODO el público en
 * páginas normales (no en sandbox), así que se quitan los vectores obvios de
 * XSS por si una cuenta se compromete o se pega HTML malicioso: etiquetas de
 * script/estilo/embebidos, manejadores on* y URLs javascript:. Delega en `sanearHtml` (lib/blog/html.ts): lista BLANCA real con
 * `sanitize-html`, en vez de la lista negra por expresiones regulares que
 * habia aqui — el saneado por regex sobre HTML es esquivable (etiquetas
 * anidadas, atributos malformados, escapes unicode) y su propio autor advertia
 * que no pretendia ser perfecto. Ademas AHORA se sanea tambien AL RENDERIZAR.
 */
export function sanitizarHtml(html: string): string {
  return sanearHtml(String(html ?? '')).trim();
}

