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
 * script/estilo/embebidos, manejadores on* y URLs javascript:. Allowlist
 * implícita conservadora; no pretende ser un sanitizador perfecto, sino cerrar
 * los caminos evidentes de ejecución de JS.
 */
export function sanitizarHtml(html: string): string {
  let s = String(html ?? '');
  // Etiquetas peligrosas (apertura y cierre); su texto interno queda inerte.
  s = s.replace(/<\/?(?:script|style|iframe|object|embed|form|input|button|link|meta|base|svg|math)\b[^>]*>/gi, '');
  // Atributos manejadores de eventos: onclick, onerror, onload…
  s = s.replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  // Neutraliza javascript:/data: en href/src.
  s = s.replace(/\b(href|src)\s*=\s*("|')\s*(?:javascript|data)\s*:[^"']*\2/gi, '$1=$2#$2');
  return s.trim();
}
