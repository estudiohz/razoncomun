/**
 * flujo-manual.test.ts
 *
 * Simula, con los datos REALES de la semilla de `0029_simulador.sql` (§6),
 * el flujo manual exigido por el gate de la ola S1 (docs/tecnico/
 * simulador-pais.md §7):
 *
 *   1. Crear/editar una partida con una fórmula inválida → rechazada.
 *   2. Guardar un parámetro derivado con un ciclo → rechazado, enseñando
 *      la cadena.
 *   3. Editar una cifra → los totales se recalculan en vivo (mismo
 *      mecanismo que usa `AreaEditorClient`: reconstruir el array de
 *      partidas con el valor editado y volver a llamar a `resolver()`).
 *   4. Publicar exige la fuente rellenada en el lado actual.
 *
 * Esto NO sustituye la verificación manual sobre `dev` con sesión de
 * admin real (que exige tener el webapp desplegado — fuera del alcance de
 * esta ola, ver informe final), pero ejercita el mismo código que
 * `adminActions.ts` invoca (`validarFormulaPartida`,
 * `validarFormulaParametroDerivado`, `puedePublicar`, `resolver`) con
 * datos idénticos a los que verá el admin en `dev`.
 */
import { describe, expect, it } from 'vitest';
import { resolver } from './resolver';
import { puedePublicar, validarFormulaParametroDerivado, validarFormulaPartida } from './validacion';
import type { ParametroInput, PartidaInput } from './tipos';

// Semilla real de 0029_simulador.sql (§6), en la forma que espera el motor.
const parametrosSemilla: ParametroInput[] = [
  {
    clave: 'cuota_media_autonomo',
    nombre: 'Cuota media de autónomo',
    unidad: '€/año',
    modo: 'fijo',
    formula: null,
    valor_actual: 3600,
    valor_rc: 2400,
    es_palanca: true,
    palanca_min: 1200,
    palanca_max: 4800,
  },
  {
    clave: 'num_autonomos_base',
    nombre: 'Número de autónomos (base)',
    unidad: 'personas',
    modo: 'fijo',
    formula: null,
    valor_actual: 3_300_000,
    valor_rc: null,
    es_palanca: false,
    palanca_min: null,
    palanca_max: null,
  },
  {
    clave: 'num_autonomos',
    nombre: 'Número de autónomos (con elasticidad)',
    unidad: 'personas',
    modo: 'formula',
    formula: 'num_autonomos_base * (1 + 0.4 * (2800 - cuota_media_autonomo) / 2800)',
    valor_actual: null,
    valor_rc: null,
    es_palanca: false,
    palanca_min: null,
    palanca_max: null,
  },
];

const partidaRetaSemilla: PartidaInput = {
  id: 'a5200000-0000-4000-8000-000000000021',
  parent_id: 'a5200000-0000-4000-8000-000000000011',
  tipo: 'ingreso',
  nombre: 'Cotizaciones de autónomos (RETA)',
  actual_modo: 'formula',
  actual_cents: null,
  actual_formula: 'num_autonomos * cuota_media_autonomo',
  rc_modo: 'formula',
  rc_cents: null,
  rc_pct: null,
  rc_formula: 'num_autonomos * cuota_media_autonomo',
  es_palanca: false,
  palanca_min: null,
  palanca_max: null,
};

const partidaDefensaSemilla: PartidaInput = {
  id: 'a5200000-0000-4000-8000-000000000013',
  parent_id: null,
  tipo: 'gasto',
  nombre: 'Defensa',
  actual_modo: 'fijo',
  actual_cents: 1_200_000_000_000,
  actual_formula: null,
  rc_modo: 'pct_actual',
  rc_cents: null,
  rc_pct: -20,
  rc_formula: null,
  es_palanca: false,
  palanca_min: null,
  palanca_max: null,
};

describe('flujo manual S1 — 1. crear partida con fórmula inválida', () => {
  it('rechaza una fórmula que referencia un parámetro que no existe en la semilla', () => {
    const r = validarFormulaPartida('num_autonomos * cuota_inexistente', parametrosSemilla);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/parámetro desconocido: cuota_inexistente/);
  });

  it('rechaza una fórmula con un intento de inyección (adversario)', () => {
    const r = validarFormulaPartida('num_autonomos; DROP TABLE sim_partidas;', parametrosSemilla);
    expect(r.ok).toBe(false);
  });

  it('acepta la fórmula real de la semilla (RETA) contra los parámetros reales', () => {
    const r = validarFormulaPartida('num_autonomos * cuota_media_autonomo', parametrosSemilla);
    expect(r.ok).toBe(true);
  });
});

describe('flujo manual S1 — 2. guardar parámetro derivado con ciclo', () => {
  it('rechaza un ciclo si alguien edita `cuota_media_autonomo` para depender de `num_autonomos` (que ya depende de la cuota)', () => {
    // num_autonomos (derivado) ya depende de cuota_media_autonomo. Si un
    // admin intentase "arreglar" cuota_media_autonomo convirtiéndola en un
    // derivado que a su vez depende de num_autonomos, cerraría el ciclo.
    const conElCandidato = parametrosSemilla.filter((p) => p.clave !== 'cuota_media_autonomo');
    const r = validarFormulaParametroDerivado('cuota_media_autonomo', 'num_autonomos / 1000', conElCandidato);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/ciclo/);
      expect(r.error).toMatch(/cuota_media_autonomo/);
      expect(r.error).toMatch(/num_autonomos/);
    }
  });

  it('acepta un parámetro derivado nuevo y coherente (sin ciclo) contra la semilla', () => {
    const r = validarFormulaParametroDerivado(
      'ingreso_medio_reta',
      'num_autonomos * cuota_media_autonomo / num_autonomos_base',
      parametrosSemilla,
    );
    expect(r.ok).toBe(true);
  });
});

const partidaCotizacionesSemilla: PartidaInput = {
  id: 'a5200000-0000-4000-8000-000000000011',
  parent_id: null,
  tipo: 'ingreso',
  nombre: 'Cotizaciones sociales',
  actual_modo: 'fijo',
  actual_cents: 15_000_000_000_000,
  actual_formula: null,
  rc_modo: 'fijo',
  rc_cents: null,
  rc_pct: null,
  rc_formula: null,
  es_palanca: false,
  palanca_min: null,
  palanca_max: null,
};

describe('flujo manual S1 — 3. editar una cifra → totales en vivo', () => {
  it('editar el valor actual de un área raíz (Defensa) recalcula balance Y el −20% de RC en vivo, sin red', () => {
    const partidas = [partidaDefensaSemilla];

    const antes = resolver(parametrosSemilla, partidas);
    // Simula exactamente lo que hace AreaEditorClient al teclear en el
    // campo "Valor actual" de la ficha: reconstruir esa partida con el
    // valor editado y volver a llamar a resolver() — mismo motor, sin red.
    const partidasEditadas = partidas.map((p) => (p.id === partidaDefensaSemilla.id ? { ...p, actual_cents: 1_000_000_000_000 } : p));
    const despues = resolver(parametrosSemilla, partidasEditadas);

    const defensaAntes = antes.partidas[0];
    const defensaDespues = despues.partidas[0];

    expect(defensaAntes.actual.propioCents).toBe(1_200_000_000_000);
    expect(defensaDespues.actual.propioCents).toBe(1_000_000_000_000);
    // El −20% de RC cascada automáticamente sobre el nuevo valor actual.
    expect(defensaDespues.rc.propioCents).toBe(800_000_000_000);
    // El balance (gasto → resta) se recalcula en vivo.
    expect(despues.balance.actualCents).toBe(antes.balance.actualCents + 200_000_000_000);
  });

  it('bajar la cuota de autónomos (palanca, elasticidad) mueve la cifra de la partida hija en vivo', () => {
    // "Cotizaciones sociales" (raíz) es un valor fijo independiente; su hija
    // "RETA" es una fórmula que SÍ reacciona a la elasticidad — el cambio se
    // ve en la cifra propia de la hija y en el sin_desglosar del padre, tal
    // y como documenta rollup.ts (el balance global solo suma raíces).
    const partidas = [partidaCotizacionesSemilla, partidaRetaSemilla];

    const antes = resolver(parametrosSemilla, partidas);
    const parametrosEditados = parametrosSemilla.map((p) =>
      p.clave === 'cuota_media_autonomo' ? { ...p, valor_actual: 1800 } : p,
    );
    const despues = resolver(parametrosEditados, partidas);

    const retaAntes = antes.partidas.find((p) => p.id === partidaRetaSemilla.id)!;
    const retaDespues = despues.partidas.find((p) => p.id === partidaRetaSemilla.id)!;
    const cotizAntes = antes.partidas.find((p) => p.id === partidaCotizacionesSemilla.id)!;
    const cotizDespues = despues.partidas.find((p) => p.id === partidaCotizacionesSemilla.id)!;

    // La cifra de la hija cambia en vivo…
    expect(retaDespues.actual.propioCents).not.toBe(retaAntes.actual.propioCents);
    // …y el "sin desglosar" del padre (raíz fija) absorbe la diferencia —
    // el balance global no se mueve porque la raíz sigue siendo un valor
    // fijo (por diseño: ver rollup.ts, el ejemplo de Defensa en el doc).
    expect(cotizDespues.actual.sinDesglosarCents).not.toBe(cotizAntes.actual.sinDesglosarCents);
    expect(despues.balance.actualCents).toBe(antes.balance.actualCents);

    // Demo bandera (D-S2b): la caída NO es lineal — el número de autónomos
    // sube al bajar la cuota (elasticidad), así que los ingresos de RETA no
    // se hunden en la misma proporción que la cuota (3600 → 1800 = mitad).
    const caidaLinealIngenua = retaAntes.actual.propioCents! / 2;
    expect(retaDespues.actual.propioCents!).toBeGreaterThan(caidaLinealIngenua);
  });
});

describe('flujo manual S1 — 4. publicar exige fuente', () => {
  it('rechaza publicar sin fuente ("PENDIENTE DE FUENTE" cuenta como rellena, es decisión editorial explícita)', () => {
    expect(puedePublicar(null).ok).toBe(false);
    expect(puedePublicar('').ok).toBe(false);
    expect(puedePublicar('   ').ok).toBe(false);
  });

  it('acepta publicar con la fuente real de la semilla rellenada', () => {
    expect(puedePublicar('Seguridad Social — cuota media RETA (PENDIENTE DE FUENTE, verificar)').ok).toBe(true);
  });
});
