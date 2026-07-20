import type { EntradaIndice } from './tipos';

/**
 * Renderizador markdown mínimo y sin dependencias.
 *
 * Cubre exactamente el subconjunto que aparece en `bocetos-home/blog-articulo.html`:
 * h2/h3, párrafos, listas, cita destacada, imagen con pie, negrita/cursiva,
 * enlaces, código en línea y el bloque `:::dato` (la caja con el número grande).
 *
 * Seguridad: el texto se escapa a HTML ANTES de aplicar ninguna regla, y las
 * URLs de enlaces e imágenes se filtran por protocolo. El HTML crudo que un
 * editor escriba en el markdown se muestra como texto, no se ejecuta — así
 * `dangerouslySetInnerHTML` en el render es seguro incluso si la cuenta de un
 * editor se ve comprometida.
 */

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Solo http(s), rutas relativas y anclas. Bloquea javascript:, data:, vbscript:. */
function urlSegura(url: string): string {
  const limpia = url.trim();
  if (/^(https?:\/\/|\/|#|mailto:)/i.test(limpia)) return escapar(limpia);
  return '#';
}

/** Slug estable para el `id` de los encabezados (y los anclas del índice). */
export function slugificar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Marcas de línea: negrita, cursiva, código, enlaces. Se aplica sobre texto YA escapado. */
function enLinea(texto: string): string {
  return texto
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, t, u) => `<a href="${urlSegura(u)}">${t}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

/**
 * Extrae el índice (h2 y h3) sin renderizar. Lo usa la ficha para el sidebar.
 * Usa exactamente los mismos ids que `renderizarMarkdown`, por construcción:
 * ambos derivan del mismo `slugificar(texto)` con el mismo desempate.
 */
export function extraerIndice(markdown: string): EntradaIndice[] {
  const entradas: EntradaIndice[] = [];
  const vistos = new Map<string, number>();

  for (const linea of markdown.split(/\r?\n/)) {
    const m = /^(##|###)\s+(.+?)\s*$/.exec(linea);
    if (!m) continue;
    const nivel = m[1].length as 2 | 3;
    const texto = m[2].replace(/[*`]/g, '');
    entradas.push({ id: idUnico(slugificar(texto), vistos), texto, nivel });
  }
  return entradas;
}

function idUnico(base: string, vistos: Map<string, number>): string {
  const raiz = base || 'seccion';
  const n = vistos.get(raiz) ?? 0;
  vistos.set(raiz, n + 1);
  return n === 0 ? raiz : `${raiz}-${n + 1}`;
}

/** Markdown → HTML. Devuelve también el índice para no recorrer el texto dos veces. */
export function renderizarMarkdown(markdown: string): {
  html: string;
  indice: EntradaIndice[];
} {
  const lineas = markdown.replace(/\r\n/g, '\n').split('\n');
  const salida: string[] = [];
  const indice: EntradaIndice[] = [];
  const vistos = new Map<string, number>();

  let i = 0;
  while (i < lineas.length) {
    const linea = lineas[i];

    // Línea en blanco
    if (!linea.trim()) {
      i += 1;
      continue;
    }

    // Bloque de dato destacado:  :::dato +9 meses
    //                            texto explicativo
    //                            :::
    if (/^:::dato\s*/.test(linea)) {
      const numero = linea.replace(/^:::dato\s*/, '').trim();
      const cuerpo: string[] = [];
      i += 1;
      while (i < lineas.length && !/^:::\s*$/.test(lineas[i])) {
        cuerpo.push(lineas[i]);
        i += 1;
      }
      i += 1; // cierre :::
      salida.push(
        `<div class="rc-dato"><div class="rc-dato-n">${enLinea(escapar(numero))}</div>` +
          `<p>${enLinea(escapar(cuerpo.join(' ').trim()))}</p></div>`,
      );
      continue;
    }

    // Encabezados h2 / h3
    const mh = /^(##|###)\s+(.+?)\s*$/.exec(linea);
    if (mh) {
      const nivel = mh[1].length as 2 | 3;
      const textoPlano = mh[2].replace(/[*`]/g, '');
      const id = idUnico(slugificar(textoPlano), vistos);
      indice.push({ id, texto: textoPlano, nivel });
      salida.push(`<h${nivel} id="${id}">${enLinea(escapar(mh[2]))}</h${nivel}>`);
      i += 1;
      continue;
    }

    // Cita destacada (una o varias líneas seguidas con ">")
    if (/^>\s?/.test(linea)) {
      const partes: string[] = [];
      while (i < lineas.length && /^>\s?/.test(lineas[i])) {
        partes.push(lineas[i].replace(/^>\s?/, ''));
        i += 1;
      }
      salida.push(`<blockquote>${enLinea(escapar(partes.join(' ')))}</blockquote>`);
      continue;
    }

    // Lista no ordenada
    if (/^[-*]\s+/.test(linea)) {
      const items: string[] = [];
      while (i < lineas.length && /^[-*]\s+/.test(lineas[i])) {
        items.push(`<li>${enLinea(escapar(lineas[i].replace(/^[-*]\s+/, '')))}</li>`);
        i += 1;
      }
      salida.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    // Imagen sola en su línea → <figure> con pie (el alt hace de pie)
    const mi = /^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/.exec(linea);
    if (mi) {
      const alt = escapar(mi[1]);
      salida.push(
        `<figure><img src="${urlSegura(mi[2])}" alt="${alt}" loading="lazy" />` +
          (mi[1] ? `<figcaption>${alt}</figcaption>` : '') +
          `</figure>`,
      );
      i += 1;
      continue;
    }

    // Párrafo: líneas consecutivas hasta un blanco o el inicio de otro bloque
    const parrafo: string[] = [];
    while (
      i < lineas.length &&
      lineas[i].trim() &&
      !/^(##|###)\s|^>|^[-*]\s|^:::|^!\[/.test(lineas[i])
    ) {
      parrafo.push(lineas[i].trim());
      i += 1;
    }
    if (parrafo.length) {
      salida.push(`<p>${enLinea(escapar(parrafo.join(' ')))}</p>`);
    }
  }

  return { html: salida.join('\n'), indice };
}

/** Texto plano (para excerpts automáticos y para estimar el tiempo de lectura). */
export function aTextoPlano(markdown: string): string {
  return markdown
    .replace(/^:::.*$/gm, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*`_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Minutos de lectura (≈200 palabras/min), mínimo 1. Se muestra en la meta. */
export function minutosLectura(markdown: string): number {
  const palabras = aTextoPlano(markdown).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(palabras / 200));
}
