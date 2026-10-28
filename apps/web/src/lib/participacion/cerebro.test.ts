import { describe, expect, it } from 'vitest';
import { cuerpoAMarkdown, markdownParaCerebro } from './cerebro';

const html =
  '<h2>Una reforma justa</h2><p>Texto con <strong>negrita</strong>.</p>' +
  '<ul><li>Uno</li><li>Dos</li></ul>' +
  '<div class="rc-tabla-wrap"><table><thead><tr><th>Tramo</th><th>Cuota</th></tr></thead>' +
  '<tbody><tr><td>0-670</td><td>9 €</td></tr></tbody></table></div>' +
  '<blockquote><p>Cita.</p></blockquote>';

describe('cuerpoAMarkdown', () => {
  it('HTML del editor → markdown, tablas incluidas', () => {
    expect(cuerpoAMarkdown(html, 'html')).toBe(
      [
        '## Una reforma justa',
        'Texto con **negrita**.',
        '- Uno\n- Dos',
        '| Tramo | Cuota |\n| --- | --- |\n| 0-670 | 9 € |',
        '> Cita.',
      ].join('\n\n'),
    );
  });

  it("no se fía de body_format='markdown' cuando el cuerpo es HTML", () => {
    expect(cuerpoAMarkdown('<p>Hola <strong>mundo</strong></p>', 'markdown')).toBe('Hola **mundo**');
  });

  it('un cuerpo que ya es markdown se respeta', () => {
    expect(cuerpoAMarkdown('## Título\n\nTexto.', 'markdown')).toBe('## Título\n\nTexto.');
  });
});

describe('markdownParaCerebro', () => {
  it('antepone la procedencia con fecha y enlace', () => {
    const md = markdownParaCerebro({
      id: 'abc',
      title: 'Vivienda',
      slug: 'vivienda',
      body: '<p>Texto.</p>',
      body_format: 'html',
      department: 'vivienda',
      adopted_at: '2026-10-28T10:00:00Z',
    });
    expect(md).toBe(
      '> Propuesta aprobada por los socios de Razón Común el 28 de octubre de 2026. Fuente: https://razoncomun.com/propuestas/vivienda\n\nTexto.',
    );
  });
});
