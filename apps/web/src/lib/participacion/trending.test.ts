import { describe, expect, it } from 'vitest';
import { scoreTrending, ordenarTrending } from './trending';
import type { EstadoPropuesta } from './types';

const AHORA = new Date('2026-07-22T12:00:00Z').getTime();

interface HiloPrueba {
  support_count: number;
  created_at: string;
  status: EstadoPropuesta;
  deadline_at: string | null;
}

function hilo(overrides: Partial<HiloPrueba> = {}): HiloPrueba {
  return {
    support_count: 10,
    created_at: '2026-07-22T10:00:00Z',
    status: 'seed',
    deadline_at: null,
    ...overrides,
  };
}

describe('scoreTrending', () => {
  it('calcula la fórmula HN: support / (horas+2)^1.5', () => {
    const p = { support_count: 20, created_at: new Date(AHORA - 3_600_000).toISOString() };
    const r = scoreTrending(p, AHORA);
    expect(r).toBeCloseTo(20 / Math.pow(1 + 2, 1.5), 6);
  });

  it('un hilo recién creado (0h) usa el suelo de 2h', () => {
    const p = { support_count: 8, created_at: new Date(AHORA).toISOString() };
    expect(scoreTrending(p, AHORA)).toBeCloseTo(8 / Math.pow(2, 1.5), 6);
  });

  it('más apoyos → score mayor a igualdad de antigüedad', () => {
    const viejo = { support_count: 5, created_at: new Date(AHORA - 7_200_000).toISOString() };
    const nuevo = { support_count: 50, created_at: new Date(AHORA - 7_200_000).toISOString() };
    expect(scoreTrending(nuevo, AHORA)).toBeGreaterThan(scoreTrending(viejo, AHORA));
  });

  it('a igualdad de apoyos, más reciente puntúa más alto', () => {
    const reciente = { support_count: 10, created_at: new Date(AHORA - 3_600_000).toISOString() };
    const antiguo = { support_count: 10, created_at: new Date(AHORA - 48 * 3_600_000).toISOString() };
    expect(scoreTrending(reciente, AHORA)).toBeGreaterThan(scoreTrending(antiguo, AHORA));
  });
});

describe('ordenarTrending', () => {
  it('excluye adopted, discarded y archived (D-P13: solo votación abierta)', () => {
    const lista = [
      hilo({ support_count: 100, status: 'adopted' }),
      hilo({ support_count: 1, status: 'seed' }),
      hilo({ support_count: 100, status: 'discarded' }),
      hilo({ support_count: 100, status: 'archived' }),
    ];
    const r = ordenarTrending(lista, AHORA);
    expect(r).toHaveLength(1);
    expect(r[0].support_count).toBe(1);
  });

  it('excluye hilos cuya deadline_at ya pasó', () => {
    const lista = [
      hilo({ support_count: 5, deadline_at: new Date(AHORA - 1000).toISOString() }),
      hilo({ support_count: 3, deadline_at: new Date(AHORA + 1000).toISOString() }),
    ];
    const r = ordenarTrending(lista, AHORA);
    expect(r).toHaveLength(1);
    expect(r[0].support_count).toBe(3);
  });

  it('ordena descendente por score', () => {
    const lista = [
      hilo({ support_count: 2, created_at: new Date(AHORA - 3_600_000).toISOString() }),
      hilo({ support_count: 50, created_at: new Date(AHORA - 3_600_000).toISOString() }),
      hilo({ support_count: 10, created_at: new Date(AHORA - 3_600_000).toISOString() }),
    ];
    const r = ordenarTrending(lista, AHORA);
    expect(r.map((p) => p.support_count)).toEqual([50, 10, 2]);
  });
});
