/**
 * Puente entre el markdown que guardamos y el HTML que entiende el editor
 * visual (TipTap).
 *
 * POR QUÉ ESTO EXISTE: el cuerpo se sigue guardando en markdown — cero
 * migración de datos y el renderizador de `markdown.ts` sigue escapando todo,
 * que es de donde viene la seguridad del `dangerouslySetInnerHTML` público.
 * El editor visual es solo una capa de edición encima.
 *
 * EL RIESGO REAL: una ida y vuelta con pérdidas destruiría contenido ya
 * publicado en silencio. Medido sobre los 24 artículos reales (28/08/2026):
 * usan h2/h3, listas, citas, negrita, enlaces, imágenes, reglas — todo
 * cubierto — pero DOS usan tablas, que el editor no sabe reproducir.
 *
 * Por eso `roundTripSeguro()` es obligatorio antes de abrir el modo visual:
 * si un documento no sobrevive la conversión, se edita en texto plano. Preferimos
 * un editor menos bonito a un artículo mutilado.
 */

/** Escapa lo mínimo para insertar texto en HTML del editor. */
function esc(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Deshace el escapado al volver del editor a markdown. */
function desesc(t: string): string {
  return t
    // Espacio duro: se devuelve como U+00A0, NO como espacio normal. Si se
    // degradara, guardar reescribiría el contenido original (lo destapó un
    // artículo con un incrustado de Instagram, lleno de &nbsp;).
    .replace(/&nbsp;/g, String.fromCharCode(160))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Marcas de línea markdown → HTML. Orden importante: enlaces antes que énfasis. */
function lineaAHtml(t: string): string {
  return esc(t)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt, url) => `<img src="${url}" alt="${alt}">`)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, txt, url) => `<a href="${url}">${txt}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

/** Marcas de línea HTML → markdown. */
function lineaAMd(h: string): string {
  return desesc(
    h
      .replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/g, '![$2]($1)')
      .replace(/<img[^>]*alt="([^"]*)"[^>]*src="([^"]*)"[^>]*>/g, '![$1]($2)')
      .replace(/<img[^>]*src="([^"]*)"[^>]*>/g, '![]($1)')
      .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g, '[$2]($1)')
      .replace(/<(strong|b)>(.*?)<\/\1>/g, '**$2**')
      .replace(/<(em|i)>(.*?)<\/\1>/g, '*$2*')
      .replace(/<code>(.*?)<\/code>/g, '`$1`')
      .replace(/<br\s*\/?>/g, ' ')
      .replace(/<[^>]+>/g, ''),
  ).trim();
}

/**
 * Markdown → HTML para cargar en el editor.
 *
 * Cubre solo el subconjunto que el editor sabe devolver. Lo que no entienda
 * (tablas, bloques `:::`) lo deja como párrafo literal, y por eso
 * `roundTripSeguro()` lo detectará y bloqueará el modo visual.
 */
export function markdownAEditor(md: string): string {
  const lineas = md.replace(/\r\n/g, '\n').split('\n');
  const salida: string[] = [];
  let i = 0;

  while (i < lineas.length) {
    const linea = lineas[i];

    if (!linea.trim()) {
      i += 1;
      continue;
    }

    const mh = /^(##|###)\s+(.+?)\s*$/.exec(linea);
    if (mh) {
      const n = mh[1].length;
      salida.push(`<h${n}>${lineaAHtml(mh[2])}</h${n}>`);
      i += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(linea)) {
      salida.push('<hr>');
      i += 1;
      continue;
    }

    if (/^>\s?/.test(linea)) {
      const partes: string[] = [];
      while (i < lineas.length && /^>\s?/.test(lineas[i])) {
        partes.push(lineas[i].replace(/^>\s?/, ''));
        i += 1;
      }
      salida.push(`<blockquote><p>${lineaAHtml(partes.join(' '))}</p></blockquote>`);
      continue;
    }

    if (/^[-*]\s+/.test(linea)) {
      const items: string[] = [];
      while (i < lineas.length && /^[-*]\s+/.test(lineas[i])) {
        items.push(`<li><p>${lineaAHtml(lineas[i].replace(/^[-*]\s+/, ''))}</p></li>`);
        i += 1;
      }
      salida.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    if (/^\d+\.\s+/.test(linea)) {
      const items: string[] = [];
      while (i < lineas.length && /^\d+\.\s+/.test(lineas[i])) {
        items.push(`<li><p>${lineaAHtml(lineas[i].replace(/^\d+\.\s+/, ''))}</p></li>`);
        i += 1;
      }
      salida.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    // Imagen sola en su línea → nodo de BLOQUE, no dentro de un <p>.
    //
    // La extensión Image de TipTap está en modo bloque: si la imagen llega
    // envuelta en un párrafo, el editor la DESCARTA al normalizar contra su
    // esquema y se pierde sin avisar. Lo detectó `editorTiptap.test.ts`, que
    // hace la ida y vuelta pasando por el editor real; los tests que solo
    // prueban los conversores no lo veían. Hay 7 artículos con imágenes.
    const mimg = /^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/.exec(linea);
    if (mimg) {
      salida.push(`<img src="${esc(mimg[2])}" alt="${esc(mimg[1])}">`);
      i += 1;
      continue;
    }

    // Párrafo: líneas seguidas hasta un blanco o el inicio de otro bloque.
    const parrafo: string[] = [];
    while (
      i < lineas.length &&
      lineas[i].trim() &&
      !/^(##|###)\s/.test(lineas[i]) &&
      !/^>\s?/.test(lineas[i]) &&
      !/^[-*]\s+/.test(lineas[i]) &&
      !/^\d+\.\s+/.test(lineas[i]) &&
      !/^(-{3,}|\*{3,}|_{3,})\s*$/.test(lineas[i])
    ) {
      parrafo.push(lineas[i]);
      i += 1;
    }
    salida.push(`<p>${lineaAHtml(parrafo.join(' '))}</p>`);
  }

  return salida.join('');
}

/** HTML del editor → markdown para guardar. */
export function editorAMarkdown(html: string): string {
  const bloques: string[] = [];
  // TipTap devuelve los bloques de primer nivel sin saltos entre ellos.
  const re =
    /<(h2|h3|p|ul|ol|blockquote)(?:\s[^>]*)?>([\s\S]*?)<\/\1>|<hr\s*\/?>|<img[^>]*>/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(html)) !== null) {
    const etiqueta = m[1];
    const dentro = m[2] ?? '';

    if (!etiqueta) {
      // Sin grupo de captura: o es un <hr> o es una imagen de bloque.
      const crudo = m[0];
      if (crudo.startsWith('<img')) {
        const t = lineaAMd(crudo);
        if (t) bloques.push(t);
      } else {
        bloques.push('---');
      }
      continue;
    }
    if (etiqueta === 'h2') bloques.push(`## ${lineaAMd(dentro)}`);
    else if (etiqueta === 'h3') bloques.push(`### ${lineaAMd(dentro)}`);
    else if (etiqueta === 'p') {
      const t = lineaAMd(dentro);
      if (t) bloques.push(t);
    } else if (etiqueta === 'blockquote') bloques.push(`> ${lineaAMd(dentro)}`);
    else if (etiqueta === 'ul' || etiqueta === 'ol') {
      const items = [...dentro.matchAll(/<li(?:\s[^>]*)?>([\s\S]*?)<\/li>/g)].map((x) =>
        lineaAMd(x[1]),
      );
      bloques.push(
        items.map((t, n) => (etiqueta === 'ul' ? `- ${t}` : `${n + 1}. ${t}`)).join('\n'),
      );
    }
  }

  return bloques.join('\n\n').trim();
}

/** Normaliza para comparar: colapsa espacios y líneas en blanco. */
function normalizar(md: string): string {
  return md
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * ¿Sobrevive este markdown a la ida y vuelta por el editor visual?
 *
 * Si devuelve `false`, el documento DEBE editarse en texto plano: contiene algo
 * que el editor no sabe reproducir (tablas, bloques `:::`, HTML crudo…) y
 * abrirlo en modo visual lo destruiría al guardar.
 */
export function roundTripSeguro(md: string): boolean {
  try {
    return normalizar(editorAMarkdown(markdownAEditor(md))) === normalizar(md);
  } catch {
    return false;
  }
}
