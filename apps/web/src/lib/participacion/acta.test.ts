import { describe, it, expect } from 'vitest';
import { generarActa, serializarActa, VERSION_ACTA } from './acta';
import { calcularResultado } from './votes';
import type { Ballot, Vote } from './types';

const vote: Vote = {
  id: 'v-1',
  proposal_id: 'p-1',
  opens_at: '2026-08-01T08:00:00.000Z',
  closes_at: '2026-08-08T08:00:00.000Z',
  quorum: 2,
  threshold: 0.6,
  scope: 'department',
  created_by: null,
  created_at: '2026-08-01T07:00:00.000Z',
} as Vote;

const ballots: Ballot[] = [
  { vote_id: 'v-1', user_id: 'bbb', choice: 'favor', weight: 1, cast_at: '2026-08-02T10:00:00.000Z' },
  { vote_id: 'v-1', user_id: 'aaa', choice: 'contra', weight: 1, cast_at: '2026-08-03T11:00:00.000Z' },
  { vote_id: 'v-1', user_id: 'ccc', choice: 'favor', weight: 0, cast_at: '2026-08-04T12:00:00.000Z' },
];

describe('acta verificable', () => {
  it('es determinista: el orden de lectura de los votos no cambia la huella', () => {
    const a = generarActa(vote, ballots);
    const b = generarActa(vote, [...ballots].reverse());
    expect(a.hash).toBe(b.hash);
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('cualquier alteración de un voto cambia la huella', () => {
    const original = generarActa(vote, ballots).hash;
    const alterado = ballots.map((b) =>
      b.user_id === 'aaa' ? { ...b, choice: 'favor' as const } : b,
    );
    expect(generarActa(vote, alterado).hash).not.toBe(original);
  });

  it('quitar un voto también cambia la huella (no vale "perder" papeletas)', () => {
    const original = generarActa(vote, ballots).hash;
    expect(generarActa(vote, ballots.slice(0, 2)).hash).not.toBe(original);
  });

  it('el contenido publicado permite recomputar el hash tal cual (contrato v1)', () => {
    const acta = generarActa(vote, ballots);
    expect(acta.version).toBe(VERSION_ACTA);
    expect(acta.contenido).toContain('acta:v1');
    expect(acta.contenido).toContain('reglas:quorum=2;umbral=0.6;ambito=department');
    // Los votos van ordenados por user_id, no por emisión.
    const votos = acta.contenido.split('votos:\n')[1].split('\n');
    expect(votos[0].startsWith('aaa;')).toBe(true);
    expect(votos[1].startsWith('bbb;')).toBe(true);
  });

  it('la serialización refleja el resultado real del recuento', () => {
    const resultado = calcularResultado(vote, ballots);
    const texto = serializarActa(vote, ballots, resultado);
    expect(texto).toContain('favor=1;contra=1;abstencion=0');
    expect(texto).toContain('quorum_alcanzado=true');
  });
});
