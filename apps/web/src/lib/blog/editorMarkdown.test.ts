import { describe, expect, it } from 'vitest';
import { editorAMarkdown, markdownAEditor, roundTripSeguro } from './editorMarkdown';

/**
 * Lo que de verdad importa aquí no es que la conversión sea bonita, sino que
 * NO PIERDA CONTENIDO. Un round-trip con pérdidas mutilaría artículos ya
 * publicados en el momento en que un editor abra y guarde.
 *
 * Los casos cubren las construcciones medidas sobre los 24 artículos reales
 * (28/08/2026) y, sobre todo, las que el editor NO sabe reproducir: ahí
 * `roundTripSeguro` tiene que decir `false` para que la UI caiga a texto plano.
 */

describe('ida y vuelta sin pérdidas', () => {
  const casos: [string, string][] = [
    ['encabezado h2', '## Vivienda'],
    ['encabezado h3', '### Cuota de autónomos'],
    ['párrafo simple', 'Un párrafo normal y corriente.'],
    ['negrita', 'Texto con **negrita** dentro.'],
    ['cursiva', 'Texto con *cursiva* dentro.'],
    ['código en línea', 'Usa `npm install` para instalar.'],
    ['enlace', 'Ver el [programa completo](https://razoncomun.com/programa).'],
    ['imagen', '![Congreso](https://api.razoncomun.com/i/congreso.webp)'],
    ['lista con guiones', '- Primero\n- Segundo\n- Tercero'],
    ['lista numerada', '1. Primero\n2. Segundo'],
    ['cita', '> Una cita destacada.'],
    ['regla horizontal', '---'],
    [
      'documento completo',
      '## Vivienda\n\nEl **problema** es claro.\n\n### Medidas\n\n- Desahucio en 48h\n- Licencias ágiles\n\n> No es ideología, son datos.\n\nVer [la propuesta](https://razoncomun.com/p/1).',
    ],
  ];

  for (const [nombre, md] of casos) {
    it(nombre, () => {
      expect(roundTripSeguro(md)).toBe(true);
      expect(editorAMarkdown(markdownAEditor(md)).trim()).toBe(md.trim());
    });
  }
});

describe('detecta lo que NO sabe reproducir', () => {
  it('marca las tablas como inseguras (2 artículos reales las usan)', () => {
    const md = '| Año | Gasto |\n| --- | --- |\n| 2025 | 10 |\n| 2026 | 12 |';
    expect(roundTripSeguro(md)).toBe(false);
  });

  it('marca los bloques ::: como inseguros', () => {
    expect(roundTripSeguro(':::dato +9 meses\nde media\n:::')).toBe(false);
    expect(roundTripSeguro(':::video https://x.com/a.mp4\n:::')).toBe(false);
  });

  it('no da por bueno un documento que perdería contenido', () => {
    const md = 'Texto normal.\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\nMás texto.';
    expect(roundTripSeguro(md)).toBe(false);
  });
});

describe('el HTML que produce es el que espera el editor', () => {
  it('envuelve los items de lista en <p> (esquema de TipTap)', () => {
    expect(markdownAEditor('- Uno')).toBe('<ul><li><p>Uno</p></li></ul>');
  });

  it('convierte la cita con párrafo dentro', () => {
    expect(markdownAEditor('> Hola')).toBe('<blockquote><p>Hola</p></blockquote>');
  });

  it('escapa el HTML que venga en el markdown', () => {
    expect(markdownAEditor('<script>alert(1)</script>')).toContain('&lt;script&gt;');
  });
});
