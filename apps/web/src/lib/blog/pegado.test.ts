import { describe, expect, it } from 'vitest';
import { htmlPegadoTieneEstructura, pareceMarkdown } from './pegado';
import { editorAMarkdown } from './editorMarkdown';

describe('pareceMarkdown', () => {
  it('un título basta', () => expect(pareceMarkdown('## Una reforma justa\n\nTexto del párrafo.')).toBe(true));
  it('una tabla basta', () =>
    expect(pareceMarkdown('| Nº | Concepto |\n| --- | --- |\n| 1 | Algo |')).toBe(true));
  it('una imagen basta', () => expect(pareceMarkdown('![Foto](https://x.com/a.jpg)')).toBe(true));
  it('negrita + lista', () =>
    expect(pareceMarkdown('Texto con **énfasis** claro.\n\n- uno\n- dos')).toBe(true));
  it('una negrita suelta NO', () => expect(pareceMarkdown('Esto lleva **solo** una negrita en la frase.')).toBe(false));
  it('prosa normal NO', () => expect(pareceMarkdown('Un párrafo normal, sin marcas, de varias palabras.')).toBe(false));
  it('texto demasiado corto NO', () => expect(pareceMarkdown('## Hola')).toBe(false));
});

describe('htmlPegadoTieneEstructura', () => {
  it('spans de VS Code: sin estructura', () =>
    expect(htmlPegadoTieneEstructura('<div style="color:#333"><span style="x">## Hola</span></div>')).toBe(false));
  it('HTML con títulos o negritas: estructura', () => {
    expect(htmlPegadoTieneEstructura('<h2>Hola</h2><p>x</p>')).toBe(true);
    expect(htmlPegadoTieneEstructura('<p>un <strong>énfasis</strong></p>')).toBe(true);
  });
});

describe('editorAMarkdown: tablas y h4', () => {
  it('convierte una tabla del editor', () => {
    const html =
      '<table><tbody><tr><th><p>Nº</p></th><th><p>Concepto</p></th></tr><tr><td><p>1</p></td><td><p>Con <strong>negrita</strong></p></td></tr></tbody></table>';
    expect(editorAMarkdown(html)).toBe('| Nº | Concepto |\n| --- | --- |\n| 1 | Con **negrita** |');
  });
  it('convierte h4', () => expect(editorAMarkdown('<h4>Detalle</h4>')).toBe('#### Detalle'));
});
