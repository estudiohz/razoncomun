import { describe, expect, it } from 'vitest';
import { cuerpoPropuestaHtml, cuerpoPropuestaTexto, formatoCuerpo } from './cuerpo';

describe('cuerpo de propuesta', () => {
  it('un borrador del bot en markdown se renderiza con estructura', () => {
    const html = cuerpoPropuestaHtml({ body: '## Problema\n\nTexto con **énfasis**.\n\n- uno\n- dos', body_format: 'markdown' });
    expect(html).toContain('<h2');
    expect(html).toContain('<strong>énfasis</strong>');
    expect(html).toContain('<li>');
    expect(html).not.toContain('##');
  });

  it('el markdown escapa el HTML que traiga dentro', () => {
    const html = cuerpoPropuestaHtml({ body: 'Hola <script>alert(1)</script>', body_format: 'markdown' });
    expect(html).not.toContain('<script');
  });

  it('el HTML del editor se sanea', () => {
    const html = cuerpoPropuestaHtml({ body: '<p>Hola</p><script>alert(1)</script>', body_format: 'html' });
    expect(html).toContain('<p>Hola</p>');
    expect(html).not.toContain('<script');
  });

  it("una fila HTML mal etiquetada como 'markdown' se sigue tratando como HTML", () => {
    expect(formatoCuerpo({ body: '<p>Texto</p>', body_format: 'markdown' })).toBe('html');
    expect(cuerpoPropuestaHtml({ body: '<p>Texto</p>', body_format: 'markdown' })).toContain('<p>Texto</p>');
  });

  it('sin body_format se asume HTML', () => {
    expect(formatoCuerpo({ body: 'Texto' })).toBe('html');
  });

  it('el texto plano no lleva marcas', () => {
    const t = cuerpoPropuestaTexto({ body: '## Título\n\nUn **párrafo**.', body_format: 'markdown' });
    expect(t).toContain('Un párrafo');
    expect(t).not.toMatch(/[#*]/);
  });
});
