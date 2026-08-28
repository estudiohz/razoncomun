import { describe, expect, it } from 'vitest';
import { aTextoPlano, prepararHtml, sanearHtml } from './html';

/**
 * Al pasar el cuerpo de markdown a HTML se pierde la garantía que daba
 * `markdown.ts` (escapar TODO). Estos tests son lo que la sustituye: si alguien
 * afloja el saneado, tienen que ponerse rojos.
 *
 * Los vectores no son inventados: son los clásicos de OWASP para editores
 * enriquecidos, más los específicos de `style`, que es la parte que más se
 * suele dejar abierta por comodidad.
 */

describe('bloquea ejecución de scripts', () => {
  const vectores: [string, string][] = [
    ['<script>', '<script>alert(1)</script>'],
    ['onerror en img', '<img src="x" onerror="alert(1)">'],
    ['onload en img', '<img src="https://x.com/a.png" onload="alert(1)">'],
    ['onclick en p', '<p onclick="alert(1)">hola</p>'],
    ['onmouseover', '<span onmouseover="alert(1)">hola</span>'],
    ['iframe', '<iframe src="https://evil.com"></iframe>'],
    ['object', '<object data="evil.swf"></object>'],
    ['embed', '<embed src="evil.swf">'],
    ['form', '<form action="https://evil.com"><input name="p"></form>'],
    ['svg con onload', '<svg onload="alert(1)"></svg>'],
    ['etiqueta style', '<style>body{display:none}</style>'],
    ['noscript', '<noscript><p>x</p></noscript>'],
  ];

  for (const [nombre, entrada] of vectores) {
    it(nombre, () => {
      const s = sanearHtml(entrada);
      expect(s).not.toMatch(/<script|<iframe|<object|<embed|<form|<style|<svg/i);
      expect(s).not.toMatch(/\son\w+\s*=/i);
      expect(s).not.toContain('alert(1)');
    });
  }
});

describe('bloquea protocolos peligrosos', () => {
  it('javascript: en href', () => {
    expect(sanearHtml('<a href="javascript:alert(1)">x</a>')).not.toContain('javascript:');
  });
  it('data: en img', () => {
    const s = sanearHtml('<img src="data:text/html;base64,PHNjcmlwdD4=">');
    expect(s).not.toContain('data:');
  });
  it('vbscript:', () => {
    expect(sanearHtml('<a href="vbscript:msgbox(1)">x</a>')).not.toContain('vbscript:');
  });
  it('protocolo relativo //evil.com', () => {
    expect(sanearHtml('<a href="//evil.com">x</a>')).not.toContain('//evil.com');
  });
});

describe('style: solo lo permitido y validado', () => {
  it('deja pasar un color hexadecimal', () => {
    expect(sanearHtml('<span style="color:#C3369E">x</span>')).toContain('color:#C3369E');
  });
  it('deja pasar la alineación', () => {
    expect(sanearHtml('<p style="text-align:center">x</p>')).toContain('text-align:center');
  });
  it('BLOQUEA url() en el estilo', () => {
    const s = sanearHtml('<span style="background-color:url(javascript:alert(1))">x</span>');
    expect(s).not.toContain('javascript');
    expect(s).not.toContain('url(');
  });
  it('BLOQUEA propiedades no listadas (position, z-index…)', () => {
    const s = sanearHtml('<span style="position:fixed;top:0;z-index:9999">x</span>');
    expect(s).not.toContain('position');
    expect(s).not.toContain('z-index');
  });
  it('BLOQUEA un color que no encaja con el patrón', () => {
    expect(sanearHtml('<span style="color:expression(alert(1))">x</span>')).not.toContain(
      'expression',
    );
  });
});

describe('conserva el formato legítimo del editor', () => {
  it('mantiene el formato de texto enriquecido', () => {
    const html =
      '<h2>Vivienda</h2><p><strong>Negrita</strong> y <em>cursiva</em> y <u>subrayado</u> y <s>tachado</s>.</p>';
    const s = sanearHtml(html);
    expect(s).toContain('<h2>Vivienda</h2>');
    expect(s).toContain('<strong>Negrita</strong>');
    expect(s).toContain('<u>subrayado</u>');
    expect(s).toContain('<s>tachado</s>');
  });

  it('mantiene tablas, listas y cita', () => {
    const html =
      '<table><tbody><tr><th>Año</th><td>2026</td></tr></tbody></table><ul><li>Uno</li></ul><blockquote>Cita</blockquote>';
    const s = sanearHtml(html);
    expect(s).toContain('<table>');
    expect(s).toContain('<th>Año</th>');
    expect(s).toContain('<li>Uno</li>');
    expect(s).toContain('<blockquote>Cita</blockquote>');
  });

  it('mantiene imagen y vídeo con sus atributos útiles', () => {
    const s = sanearHtml(
      '<img src="https://api.razoncomun.com/i/a.webp" alt="Foto"><video src="https://api.razoncomun.com/v/a.mp4" controls></video>',
    );
    expect(s).toContain('src="https://api.razoncomun.com/i/a.webp"');
    expect(s).toContain('alt="Foto"');
    expect(s).toContain('<video');
    expect(s).toContain('controls');
  });

  it('añade rel de seguridad a los enlaces externos (tabnabbing)', () => {
    const s = sanearHtml('<a href="https://externo.com">x</a>');
    expect(s).toContain('rel="noopener noreferrer"');
    expect(s).toContain('target="_blank"');
  });

  it('no fuerza target en enlaces internos', () => {
    expect(sanearHtml('<a href="/programa">x</a>')).not.toContain('target=');
  });
});

describe('prepararHtml: índice y saneado en una pasada', () => {
  it('extrae el índice y pone ids estables', () => {
    const { html, indice } = prepararHtml('<h2>Vivienda</h2><p>x</p><h3>Medidas</h3>');
    expect(indice).toHaveLength(2);
    expect(indice[0]).toMatchObject({ id: 'vivienda', texto: 'Vivienda', nivel: 2 });
    expect(indice[1]).toMatchObject({ id: 'medidas', nivel: 3 });
    expect(html).toContain('<h2 id="vivienda">');
  });

  it('desempata encabezados repetidos', () => {
    const { indice } = prepararHtml('<h2>Datos</h2><h2>Datos</h2>');
    expect(indice.map((x) => x.id)).toEqual(['datos', 'datos-2']);
  });

  it('sanea TAMBIÉN al preparar, no solo al guardar', () => {
    const { html } = prepararHtml('<h2>Título</h2><script>alert(1)</script>');
    expect(html).not.toContain('<script');
  });
});

describe('aTextoPlano (alimenta el corpus del RAG)', () => {
  it('quita las etiquetas y conserva los saltos de bloque', () => {
    const t = aTextoPlano('<h2>Vivienda</h2><p>Uno</p><p>Dos</p>');
    expect(t).toBe('Vivienda\nUno\nDos');
  });
  it('no deja etiquetas que ensucien el embedding', () => {
    const t = aTextoPlano('<p><strong>Negrita</strong> y <a href="https://x.com">enlace</a>.</p>');
    expect(t).not.toMatch(/<[^>]+>/);
    expect(t).toBe('Negrita y enlace.');
  });
  it('sanea antes de extraer: un script no aporta texto al corpus', () => {
    expect(aTextoPlano('<p>Hola</p><script>alert(1)</script>')).toBe('Hola');
  });
});
