import { describe, expect, it } from 'vitest';
import { CHECKLIST_M5, bloqueosAprobar, eurosACentimos, htmlATexto, replicaObligatoria, textoAHtml } from './casos';

const todoMarcado = CHECKLIST_M5.map((c) => c.id);
const base = {
  status: 'analyzed' as const,
  adjudicatario: null,
  es_persona_fisica: false,
  replica_solicitada_at: null,
  hechos_html: '<p>Hechos</p>',
  verificacion: 'coincide',
  reel_url: 'https://www.instagram.com/reel/x/',
  reel_autor: '@elrastrodeldinero',
};

describe('replicaObligatoria (D-A13)', () => {
  it('obliga si nombra empresa o persona física', () => {
    expect(replicaObligatoria({ adjudicatario: 'Acme, S.L.', es_persona_fisica: false })).toBe(true);
    expect(replicaObligatoria({ adjudicatario: null, es_persona_fisica: true })).toBe(true);
  });
  it('no obliga si solo nombra al órgano', () => {
    expect(replicaObligatoria({ adjudicatario: '  ', es_persona_fisica: false })).toBe(false);
  });
});

describe('bloqueosAprobar', () => {
  it('deja aprobar un caso completo', () => {
    expect(bloqueosAprobar(base, true, todoMarcado)).toEqual([]);
  });
  it('exige prueba principal, hechos y checklist', () => {
    const m = bloqueosAprobar({ ...base, hechos_html: ' ' }, false, []);
    expect(m.join(' ')).toMatch(/hechos/);
    expect(m.join(' ')).toMatch(/prueba/);
    expect(m.join(' ')).toMatch(/checklist/);
  });
  it('exige réplica si nombra empresa', () => {
    expect(bloqueosAprobar({ ...base, adjudicatario: 'Acme' }, true, todoMarcado)).toHaveLength(1);
    expect(
      bloqueosAprobar({ ...base, adjudicatario: 'Acme', replica_solicitada_at: '2026-11-01' }, true, todoMarcado),
    ).toEqual([]);
  });
  it('exige la mención del reel original', () => {
    expect(bloqueosAprobar({ ...base, reel_autor: null }, true, todoMarcado).join(' ')).toMatch(/origen/);
  });
  it('no aprueba lo ya publicado o descartado', () => {
    expect(bloqueosAprobar({ ...base, status: 'dismissed' }, true, todoMarcado)).toHaveLength(1);
  });
});

describe('eurosACentimos', () => {
  it.each([
    ['12.345,67 €', 1234567],
    ['12345.67', 1234567],
    ['1.200.000', 120000000],
    ['950', 95000],
    ['', null],
    ['doce', null],
  ])('%s → %s', (t, c) => expect(eurosACentimos(t)).toBe(c));
});

describe('textoAHtml / htmlATexto', () => {
  it('escapa y separa párrafos, y vuelve igual', () => {
    const t = 'Uno <b>&</b>\nsigue\n\nDos "x"';
    const h = textoAHtml(t)!;
    expect(h).toBe('<p>Uno &lt;b&gt;&amp;&lt;/b&gt;<br>sigue</p><p>Dos &quot;x&quot;</p>');
    expect(htmlATexto(h)).toBe(t);
  });
  it('vacío → null', () => expect(textoAHtml('  ')).toBeNull());
});

describe('mención del reel original (0073)', () => {
  it('limpia el seguimiento de Instagram pero no rompe YouTube', async () => {
    const { limpiarUrlReel } = await import('./casos');
    expect(limpiarUrlReel('https://www.instagram.com/reel/DfDMVeZMItj/?srtk=YzZk')).toBe('https://www.instagram.com/reel/DfDMVeZMItj/');
    expect(limpiarUrlReel('https://www.youtube.com/watch?v=abc')).toBe('https://www.youtube.com/watch?v=abc');
    expect(limpiarUrlReel('no-es-url')).toBeNull();
  });
  it('normaliza el autor a @usuario', async () => {
    const { normalizarAutor } = await import('./casos');
    expect(normalizarAutor('elrastrodeldinero')).toBe('@elrastrodeldinero');
    expect(normalizarAutor('https://www.instagram.com/elrastrodeldinero/')).toBe('@elrastrodeldinero');
    expect(normalizarAutor('El Rastro del Dinero')).toBe('El Rastro del Dinero');
    expect(normalizarAutor('  ')).toBeNull();
  });
});

describe('origen que no es un reel', () => {
  it('usa el dominio como medio por defecto', async () => {
    const { autorPorDefecto } = await import('./casos');
    expect(autorPorDefecto('https://www.elconfidencial.com/espana/2026/x.html')).toBe('elconfidencial.com');
    expect(autorPorDefecto('https://www.instagram.com/reel/x/')).toBeNull();
    expect(autorPorDefecto(null)).toBeNull();
  });
});
