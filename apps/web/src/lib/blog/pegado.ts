/**
 * ¿Este texto pegado es markdown? Lo usa el editor visual para convertirlo en
 * títulos, listas, tablas e imágenes en vez de dejar `##` y `**` literales.
 *
 * Es deliberadamente conservador: un `**` suelto o un guion no bastan. Se
 * convierte si hay un título, una tabla o una imagen, o si coinciden al menos
 * dos marcas distintas. Convertir de más es peor que no convertir: el usuario
 * puede estar pegando texto que de verdad lleva asteriscos.
 */
export function pareceMarkdown(texto: string): boolean {
  const t = texto.replace(/\r\n/g, '\n');
  if (t.trim().length < 12) return false;

  const titulo = /^#{1,4}\s+\S/m.test(t);
  const tabla = /^\s*\|.+\|\s*\n\s*\|[\s:|-]+\|\s*$/m.test(t);
  const imagen = /!\[[^\]]*\]\([^)\s]+\)/.test(t);
  if (titulo || tabla || imagen) return true;

  const marcas = [
    /\*\*[^*\n]+\*\*/.test(t),
    (t.match(/^\s*[-*]\s+\S/gm) ?? []).length >= 2,
    (t.match(/^\s*\d+\.\s+\S/gm) ?? []).length >= 2,
    /^>\s+\S/m.test(t),
    /^\s*-{3,}\s*$/m.test(t),
    /\[[^\]]+\]\(https?:\/\/[^)\s]+\)/.test(t),
  ];
  return marcas.filter(Boolean).length >= 2;
}

/**
 * El portapapeles de VS Code o de un editor de texto trae `text/html` con
 * `<span>` estilados pero sin estructura. Solo si el HTML pegado ya tiene
 * estructura real (títulos, listas, negritas…) se deja al editor interpretarlo.
 */
export function htmlPegadoTieneEstructura(html: string): boolean {
  return /<(h[1-6]|ul|ol|li|table|strong|b|em|i|blockquote)[\s>]/i.test(html);
}
