import { prepararCuerpo } from '@/lib/blog/cuerpo';
import { htmlATexto } from '@/lib/blog/html';
import type { Propuesta } from './types';

type ConCuerpo = Pick<Propuesta, 'body'> & Partial<Pick<Propuesta, 'body_format'>>;

/**
 * Formato REAL del cuerpo de una propuesta.
 *
 * Lo normal es HTML (editor visual). Pero el RC-bot escribe sus borradores en
 * texto plano o markdown, y `body_format` lo marca. Se exige además que no
 * empiece por una etiqueta: antes de la 0063 la columna valía 'markdown' por
 * defecto en filas que ya eran HTML, y renderizar eso como markdown las
 * mostraría como texto con etiquetas visibles.
 */
export function formatoCuerpo(p: ConCuerpo): 'markdown' | 'html' {
  return p.body_format === 'markdown' && !/^\s*</.test(p.body) ? 'markdown' : 'html';
}

/** HTML seguro del cuerpo, listo para pintar (saneado / markdown escapado). */
export function cuerpoPropuestaHtml(p: ConCuerpo): string {
  return prepararCuerpo(p.body, formatoCuerpo(p)).html;
}

/** Texto plano del cuerpo: extractos de lista, metadescripción, JSON-LD. */
export function cuerpoPropuestaTexto(p: ConCuerpo): string {
  return htmlATexto(cuerpoPropuestaHtml(p));
}
