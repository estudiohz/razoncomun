import { renderizarMarkdown } from './markdown';
import { prepararHtml } from './html';
import type { EntradaIndice } from './tipos';

export type FormatoCuerpo = 'markdown' | 'html';

/**
 * Punto ÚNICO por el que pasa cualquier cuerpo de contenido antes de pintarse.
 *
 * Convive el contenido en los dos formatos a propósito (columna `body_format`,
 * migración 0049):
 *  - `html`   → contenido del editor visual. Se SANEA aquí, en el render, no
 *               solo al guardar: así una fila que entre por otra vía
 *               (importación, SQL a mano, un bug futuro) tampoco puede
 *               inyectar nada.
 *  - `markdown` → contenido heredado y el que el automatismo de n8n sigue
 *               escribiendo en el cerebro. El renderizador propio escapa todo.
 *
 * Ambos caminos devuelven HTML seguro y el índice de encabezados, así que
 * quien pinta no tiene que saber de qué formato viene.
 */
export function prepararCuerpo(
  body: string | null | undefined,
  formato: FormatoCuerpo | null | undefined,
): { html: string; indice: EntradaIndice[] } {
  const texto = body ?? '';
  if (!texto) return { html: '', indice: [] };
  return formato === 'html' ? prepararHtml(texto) : renderizarMarkdown(texto);
}
