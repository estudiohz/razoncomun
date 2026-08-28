import { describe, expect, it } from 'vitest';
import { renderizarMarkdown } from './markdown';

/**
 * Tests de los bloques multimedia `:::video` y `:::pdf`, añadidos para el
 * editor visual (el cuerpo se sigue guardando en markdown).
 *
 * El foco está en la SEGURIDAD: el renderizador escapa todo el texto antes de
 * aplicar reglas y filtra las URLs por protocolo, y ese contrato es lo que
 * permite usar `dangerouslySetInnerHTML` aguas abajo. Si un cambio futuro lo
 * rompe, estos tests tienen que fallar.
 */

describe(':::video', () => {
  it('renderiza un <video> con controles y sin autoplay', () => {
    const { html } = renderizarMarkdown(':::video https://api.razoncomun.com/v/clip.mp4\n:::');
    expect(html).toContain('<video controls preload="metadata"');
    expect(html).toContain('src="https://api.razoncomun.com/v/clip.mp4"');
    expect(html).not.toContain('autoplay');
  });

  it('incluye el pie cuando se escribe, y lo omite cuando no', () => {
    const con = renderizarMarkdown(':::video https://x.com/a.mp4\nRueda de prensa\n:::').html;
    expect(con).toContain('<figcaption>Rueda de prensa</figcaption>');

    const sin = renderizarMarkdown(':::video https://x.com/a.mp4\n:::').html;
    expect(sin).not.toContain('<figcaption>');
  });

  it('neutraliza una URL con protocolo peligroso', () => {
    const { html } = renderizarMarkdown(':::video javascript:alert(1)\n:::');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('src="#"');
  });

  it('escapa el HTML que se cuele en el pie', () => {
    const { html } = renderizarMarkdown(
      ':::video https://x.com/a.mp4\n<img src=x onerror=alert(1)>\n:::',
    );
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });
});

describe(':::pdf', () => {
  it('genera un enlace de descarga con rel de seguridad', () => {
    const { html } = renderizarMarkdown(':::pdf https://api.razoncomun.com/d/informe.pdf\n:::');
    expect(html).toContain('href="https://api.razoncomun.com/d/informe.pdf"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('usa un texto por defecto si no se indica ninguno', () => {
    const { html } = renderizarMarkdown(':::pdf https://x.com/a.pdf\n:::');
    expect(html).toContain('Descargar documento (PDF)');
  });

  it('respeta el texto del enlace cuando se escribe', () => {
    const { html } = renderizarMarkdown(':::pdf https://x.com/a.pdf\nCuentas 2026\n:::');
    expect(html).toContain('>Cuentas 2026</a>');
  });

  it('neutraliza una URL con protocolo peligroso', () => {
    const { html } = renderizarMarkdown(':::pdf javascript:alert(1)\nPincha\n:::');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('href="#"');
  });
});

describe('no rompe lo que ya funcionaba', () => {
  it('sigue renderizando encabezados, índice y el bloque :::dato', () => {
    const { html, indice } = renderizarMarkdown(
      '## Vivienda\n\nTexto **en negrita**.\n\n:::dato +9 meses\nde media\n:::',
    );
    expect(html).toContain('<h2 id="vivienda">Vivienda</h2>');
    expect(html).toContain('<strong>en negrita</strong>');
    expect(html).toContain('rc-dato-n');
    expect(indice).toHaveLength(1);
    expect(indice[0]).toMatchObject({ id: 'vivienda', nivel: 2 });
  });
});
