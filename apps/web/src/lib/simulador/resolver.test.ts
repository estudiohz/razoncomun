import { describe, expect, it } from 'vitest';
import { resolver } from './resolver';
import type { ParametroInput, PartidaInput } from './tipos';

function parametroFijo(overrides: Partial<ParametroInput> & { clave: string; valor_actual: number }): ParametroInput {
  return {
    clave: overrides.clave,
    nombre: overrides.nombre ?? overrides.clave,
    unidad: overrides.unidad ?? null,
    modo: 'fijo',
    formula: null,
    valor_actual: overrides.valor_actual,
    valor_rc: overrides.valor_rc ?? null,
    es_palanca: overrides.es_palanca ?? false,
    palanca_min: overrides.palanca_min ?? null,
    palanca_max: overrides.palanca_max ?? null,
  };
}

function parametroDerivado(clave: string, formula: string, nombre = clave): ParametroInput {
  return {
    clave,
    nombre,
    unidad: null,
    modo: 'formula',
    formula,
    valor_actual: null,
    valor_rc: null,
    es_palanca: false,
    palanca_min: null,
    palanca_max: null,
  };
}

function partidaBase(overrides: Partial<PartidaInput> & { id: string; tipo: 'ingreso' | 'gasto' }): PartidaInput {
  return {
    parent_id: null,
    nombre: overrides.nombre ?? overrides.id,
    ambito: 'estatal',
    ministry_id: null,
    color: null,
    actual_modo: 'fijo',
    actual_cents: null,
    actual_formula: null,
    rc_modo: 'fijo',
    rc_cents: null,
    rc_pct: null,
    rc_formula: null,
    es_palanca: false,
    palanca_min: null,
    palanca_max: null,
    ...overrides,
  };
}

describe('resolver — rc_pct', () => {
  it('aplica un porcentaje sobre el actual ya resuelto', () => {
    const partidas: PartidaInput[] = [
      partidaBase({
        id: 'defensa',
        tipo: 'gasto',
        actual_modo: 'fijo',
        actual_cents: 1_200_000_000_000,
        rc_modo: 'pct_actual',
        rc_pct: -20,
      }),
    ];
    const modelo = resolver([], partidas);
    const defensa = modelo.partidas[0];
    expect(defensa.actual.propioCents).toBe(1_200_000_000_000);
    expect(defensa.rc.propioCents).toBe(960_000_000_000); // -20%
  });

  it('si el actual no se resuelve, el pct_actual tampoco (nunca NaN)', () => {
    const partidas: PartidaInput[] = [
      partidaBase({
        id: 'rota',
        tipo: 'gasto',
        actual_modo: 'formula',
        actual_formula: 'no_existe * 2',
        rc_modo: 'pct_actual',
        rc_pct: -10,
      }),
    ];
    const modelo = resolver([], partidas);
    const rota = modelo.partidas[0];
    expect(rota.actual.propioCents).toBeNull();
    expect(rota.rc.propioCents).toBeNull();
    expect(rota.rc.error).toMatch(/depende del valor actual/);
  });
});

describe('resolver — parámetro derivado en cadena', () => {
  it('resuelve A → B → C (derivado que depende de un derivado que depende de un base)', () => {
    const parametros: ParametroInput[] = [
      parametroFijo({ clave: 'base', valor_actual: 10 }),
      parametroDerivado('nivel1', 'base * 2'), // 20
      parametroDerivado('nivel2', 'nivel1 + 5'), // 25
    ];
    const modelo = resolver(parametros, []);
    const porClave = Object.fromEntries(modelo.parametros.map((p) => [p.clave, p]));
    expect(porClave.base.valorActual).toBe(10);
    expect(porClave.nivel1.valorActual).toBe(20);
    expect(porClave.nivel2.valorActual).toBe(25);
    expect(porClave.nivel2.errorActual).toBeUndefined();
  });

  it('demo bandera (D-S2b): la elasticidad de autónomos evita que los ingresos caigan linealmente', () => {
    const parametros: ParametroInput[] = [
      parametroFijo({ clave: 'cuota_media_autonomo', valor_actual: 3600, valor_rc: 2400, es_palanca: true, palanca_min: 1200, palanca_max: 4800 }),
      parametroFijo({ clave: 'num_autonomos_base', valor_actual: 3_300_000 }),
      parametroDerivado('num_autonomos', 'num_autonomos_base * (1 + 0.4 * (2800 - cuota_media_autonomo) / 2800)'),
    ];
    const partidas: PartidaInput[] = [
      partidaBase({
        id: 'reta',
        tipo: 'ingreso',
        actual_modo: 'formula',
        actual_formula: 'num_autonomos * cuota_media_autonomo',
        rc_modo: 'formula',
        rc_formula: 'num_autonomos * cuota_media_autonomo',
      }),
    ];

    const modelo = resolver(parametros, partidas);
    const reta = modelo.partidas[0];

    // Ingresos "actual" (cuota 3600, sin elasticidad porque cuota=cuota base): num_autonomos_actual = base * (1 + 0.4*(2800-3600)/2800)
    const numAutonomosActualEsperado = 3_300_000 * (1 + (0.4 * (2800 - 3600)) / 2800);
    const ingresoActualEsperado = Math.round(numAutonomosActualEsperado * 3600 * 100);
    expect(reta.actual.propioCents).toBe(ingresoActualEsperado);

    // La caída lineal ingenua sería: ingresoActual * (2400/3600) = -33%. Con
    // elasticidad, el nº de autónomos SUBE al bajar la cuota y compensa parte
    // de la caída — el RC no cae tanto como esa proporción lineal.
    const caidaLinealIngenua = ingresoActualEsperado * (2400 / 3600);
    expect(reta.rc.propioCents!).toBeGreaterThan(caidaLinealIngenua);
  });
});

describe('resolver — ciclo entre parámetros derivados', () => {
  it('rechaza un ciclo directo a→b→a y enseña la cadena', () => {
    const parametros: ParametroInput[] = [parametroDerivado('a', 'b + 1'), parametroDerivado('b', 'a + 1')];
    const modelo = resolver(parametros, []);
    const a = modelo.parametros.find((p) => p.clave === 'a')!;
    const b = modelo.parametros.find((p) => p.clave === 'b')!;

    // Al menos uno de los dos debe reportar el ciclo con su cadena legible.
    const errores = [a.errorActual, b.errorActual].filter(Boolean) as string[];
    expect(errores.length).toBeGreaterThan(0);
    expect(errores.some((e) => /ciclo/.test(e))).toBe(true);
    expect(errores.some((e) => /a→b→a|b→a→b/.test(e))).toBe(true);

    // Nunca debe colgarse ni devolver NaN/undefined silencioso.
    expect(a.valorActual).toBeNull();
    expect(b.valorActual).toBeNull();
  });

  it('rechaza un ciclo de auto-referencia (a depende de sí mismo)', () => {
    const parametros: ParametroInput[] = [parametroDerivado('a', 'a + 1')];
    const modelo = resolver(parametros, []);
    const a = modelo.parametros[0];
    expect(a.errorActual).toMatch(/ciclo/);
    expect(a.errorActual).toMatch(/a→a/);
  });

  it('un ciclo largo (a→b→c→a) también se detecta y no cuelga el proceso', () => {
    const parametros: ParametroInput[] = [
      parametroDerivado('a', 'b + 1'),
      parametroDerivado('b', 'c + 1'),
      parametroDerivado('c', 'a + 1'),
    ];
    const modelo = resolver(parametros, []);
    const errores = modelo.parametros.map((p) => p.errorActual).filter(Boolean);
    expect(errores.length).toBeGreaterThan(0);
    expect(errores.some((e) => /ciclo/.test(e!))).toBe(true);
  });
});

describe('resolver — balance con partida sin resolver', () => {
  it('excluye la partida rota del balance y la reporta en sinResolver', () => {
    const partidas: PartidaInput[] = [
      partidaBase({ id: 'ingreso_ok', tipo: 'ingreso', actual_cents: 1000 }),
      partidaBase({ id: 'gasto_roto', tipo: 'gasto', actual_modo: 'formula', actual_formula: 'x / 0' }),
    ];
    const modelo = resolver([], partidas);
    expect(modelo.balance.actualCents).toBe(1000); // solo suma la raíz resuelta
    expect(modelo.sinResolver.some((e) => e.id === 'gasto_roto' && e.lado === 'actual')).toBe(true);
  });
});

describe('resolver — overrides (palancas movidas)', () => {
  it('un override de parámetro recalcula en vivo el lado actual y cascada a los derivados', () => {
    const parametros: ParametroInput[] = [
      parametroFijo({ clave: 'cuota_media_autonomo', valor_actual: 3600, valor_rc: 2400 }),
      parametroFijo({ clave: 'num_autonomos_base', valor_actual: 3_300_000 }),
      parametroDerivado('num_autonomos', 'num_autonomos_base * (1 + 0.4 * (2800 - cuota_media_autonomo) / 2800)'),
    ];
    const sinOverride = resolver(parametros, []);
    const conOverride = resolver(parametros, [], { parametros: { cuota_media_autonomo: 1200 } });

    const numAutonomosSin = sinOverride.parametros.find((p) => p.clave === 'num_autonomos')!.valorActual!;
    const numAutonomosCon = conOverride.parametros.find((p) => p.clave === 'num_autonomos')!.valorActual!;
    expect(numAutonomosCon).toBeGreaterThan(numAutonomosSin);

    // El lado RC de cuota_media_autonomo NO se mueve (tiene valor_rc explícito).
    const rcSin = sinOverride.parametros.find((p) => p.clave === 'cuota_media_autonomo')!.valorRC;
    const rcCon = conOverride.parametros.find((p) => p.clave === 'cuota_media_autonomo')!.valorRC;
    expect(rcCon).toBe(rcSin);
    expect(rcCon).toBe(2400);
  });

  it('un override de partida reemplaza el propio actual y cascada al pct_actual de RC', () => {
    const partidas: PartidaInput[] = [
      partidaBase({ id: 'defensa', tipo: 'gasto', actual_cents: 1_000_000, rc_modo: 'pct_actual', rc_pct: -20 }),
    ];
    const modelo = resolver([], partidas, { partidas: { defensa: 2_000_000 } });
    const defensa = modelo.partidas[0];
    expect(defensa.actual.propioCents).toBe(2_000_000);
    expect(defensa.rc.propioCents).toBe(1_600_000);
  });
});
