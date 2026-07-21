import { describe, expect, it } from 'vitest';
import { calcularRollup } from './rollup';

describe('rollup — sin_desglosar y descuadre', () => {
  it('calcula sin_desglosar positivo cuando el propio del padre alcanza para los hijos', () => {
    const r = calcularRollup([
      { id: 'defensa', parentId: null, tipo: 'gasto', propioCents: 1_200_000_000_000 },
      { id: 'personal', parentId: 'defensa', tipo: 'gasto', propioCents: 600_000_000_000 },
      { id: 'equipamiento', parentId: 'defensa', tipo: 'gasto', propioCents: 350_000_000_000 },
      { id: 'operaciones', parentId: 'defensa', tipo: 'gasto', propioCents: 150_000_000_000 },
    ]);

    const defensa = r.nodos.get('defensa')!;
    expect(defensa.hijosCents).toBe(1_100_000_000_000);
    expect(defensa.sinDesglosarCents).toBe(100_000_000_000);
    expect(defensa.descuadre).toBe(false);
  });

  it('marca descuadre cuando los hijos suman más que el total declarado del padre', () => {
    const r = calcularRollup([
      { id: 'padre', parentId: null, tipo: 'gasto', propioCents: 100 },
      { id: 'hijo1', parentId: 'padre', tipo: 'gasto', propioCents: 70 },
      { id: 'hijo2', parentId: 'padre', tipo: 'gasto', propioCents: 60 },
    ]);

    const padre = r.nodos.get('padre')!;
    expect(padre.hijosCents).toBe(130);
    expect(padre.sinDesglosarCents).toBe(-30);
    expect(padre.descuadre).toBe(true);
  });

  it('un hijo sin resolver contribuye 0 a la suma del padre, nunca NaN', () => {
    const r = calcularRollup([
      { id: 'padre', parentId: null, tipo: 'gasto', propioCents: 100 },
      { id: 'hijoOk', parentId: 'padre', tipo: 'gasto', propioCents: 40 },
      { id: 'hijoRoto', parentId: 'padre', tipo: 'gasto', propioCents: null },
    ]);

    const padre = r.nodos.get('padre')!;
    expect(padre.hijosCents).toBe(40);
    expect(padre.sinDesglosarCents).toBe(60);
    expect(Number.isNaN(padre.sinDesglosarCents)).toBe(false);
  });
});

describe('rollup — balance con partida sin resolver', () => {
  it('excluye una raíz sin resolver del balance y la lista aparte', () => {
    const r = calcularRollup([
      { id: 'ingreso1', parentId: null, tipo: 'ingreso', propioCents: 1000 },
      { id: 'ingreso2', parentId: null, tipo: 'ingreso', propioCents: null }, // sin resolver
      { id: 'gasto1', parentId: null, tipo: 'gasto', propioCents: 300 },
    ]);

    // balance = 1000 (ingreso1) - 300 (gasto1); ingreso2 NO se suma (ni como 0 silencioso: se excluye y se reporta)
    expect(r.balanceCents).toBe(700);
    expect(r.raicesSinResolver).toEqual(['ingreso2']);
  });

  it('el balance nunca es NaN aunque falten varias raíces', () => {
    const r = calcularRollup([
      { id: 'i1', parentId: null, tipo: 'ingreso', propioCents: null },
      { id: 'g1', parentId: null, tipo: 'gasto', propioCents: null },
    ]);
    expect(r.balanceCents).toBe(0);
    expect(Number.isNaN(r.balanceCents)).toBe(false);
    expect(r.raicesSinResolver.sort()).toEqual(['g1', 'i1']);
  });
});
