import { describe, expect, it } from 'vitest';
import { resolver } from '@/lib/simulador/resolver';
import { formatoEuros } from '@/lib/simulador/formato';
import { detectarCascada } from './cascada';
import type { ParametroInput, PartidaInput } from '@/lib/simulador/tipos';

// Tests del generador de cascada de /pais (ola S2) sobre datos equivalentes
// a la semilla de 0029_simulador.sql: verifica que detectarCascada() cuenta
// la misma historia honesta que el motor, incluidos los casos donde el
// balance NO se mueve (root con cifra oficial fija) frente a donde SÍ se
// mueve (root palanca directa) — riesgo 1b del doc de arquitectura: nunca
// reclamar un efecto que el resolver no ha producido.
describe('detectarCascada() — /pais', () => {
  const parametros: ParametroInput[] = [
    { clave: 'cuota_media_autonomo', nombre: 'Cuota media de autónomo', unidad: '€/año', modo: 'fijo', formula: null, valor_actual: 3600, valor_rc: 2400, es_palanca: true, palanca_min: 1200, palanca_max: 4800 },
    { clave: 'num_autonomos_base', nombre: 'Número de autónomos (base)', unidad: 'personas', modo: 'fijo', formula: null, valor_actual: 3300000, valor_rc: null, es_palanca: false, palanca_min: null, palanca_max: null },
    { clave: 'num_autonomos', nombre: 'Número de autónomos (con elasticidad)', unidad: 'personas', modo: 'formula', formula: 'num_autonomos_base * (1 + 0.4 * (2800 - cuota_media_autonomo) / 2800)', valor_actual: null, valor_rc: null, es_palanca: false, palanca_min: null, palanca_max: null },
  ];

  const partidas: PartidaInput[] = [
    { id: 'root-cotiz', parent_id: null, tipo: 'ingreso', nombre: 'Cotizaciones sociales', actual_modo: 'fijo', actual_cents: 15000000000000, actual_formula: null, rc_modo: 'fijo', rc_cents: null, rc_pct: null, rc_formula: null, es_palanca: false, palanca_min: null, palanca_max: null },
    { id: 'hija-reta', parent_id: 'root-cotiz', tipo: 'ingreso', nombre: 'Cotizaciones de autónomos (RETA)', actual_modo: 'formula', actual_cents: null, actual_formula: 'num_autonomos * cuota_media_autonomo', rc_modo: 'formula', rc_cents: null, rc_pct: null, rc_formula: 'num_autonomos * cuota_media_autonomo', es_palanca: false, palanca_min: null, palanca_max: null },
    { id: 'root-pensiones', parent_id: null, tipo: 'gasto', nombre: 'Pensiones', actual_modo: 'fijo', actual_cents: 19000000000000, actual_formula: null, rc_modo: 'fijo', rc_cents: 19000000000000, rc_pct: null, rc_formula: null, es_palanca: true, palanca_min: 15000000000000, palanca_max: 25000000000000 },
  ];

  it('bajar la cuota de autónomo sube num_autonomos (elasticidad) y mueve el ingreso RETA, sin hundirlo linealmente', () => {
    const antes = resolver(parametros, partidas);
    const despues = resolver(parametros, partidas, { parametros: { cuota_media_autonomo: 1800 } });

    const numAutonomosAntes = antes.parametros.find((p) => p.clave === 'num_autonomos')!.valorActual!;
    const numAutonomosDespues = despues.parametros.find((p) => p.clave === 'num_autonomos')!.valorActual!;
    expect(numAutonomosDespues).toBeGreaterThan(numAutonomosAntes); // sube al bajar la cuota

    const retaAntes = antes.partidas.find((p) => p.id === 'hija-reta')!.actual.propioCents!;
    const retaDespues = despues.partidas.find((p) => p.id === 'hija-reta')!.actual.propioCents!;
    // Si NO hubiera elasticidad, el ingreso caería a la mitad exacta (cuota /2).
    // Con elasticidad compensa parte de la caída: cae MENOS de la mitad.
    const caidaLineal = retaAntes / 2;
    expect(retaDespues).toBeGreaterThan(caidaLineal);

    // La raíz "Cotizaciones sociales" tiene cifra oficial FIJA: no se mueve.
    const rootAntes = antes.partidas.find((p) => p.id === 'root-cotiz')!.actual.propioCents;
    const rootDespues = despues.partidas.find((p) => p.id === 'root-cotiz')!.actual.propioCents;
    expect(rootDespues).toBe(rootAntes);
    // ...pero el "sin desglosar" SÍ refleja el movimiento interno (honestidad del modelo).
    expect(despues.partidas.find((p) => p.id === 'root-cotiz')!.actual.sinDesglosarCents).not.toBe(
      antes.partidas.find((p) => p.id === 'root-cotiz')!.actual.sinDesglosarCents,
    );
    // Por tanto el balance actual NO se mueve con esta palanca (root fijo).
    expect(despues.balance.actualCents).toBe(antes.balance.actualCents);
    // Y el lado RC de la partida RETA tampoco se mueve (el override solo pilota el lado actual).
    expect(despues.partidas.find((p) => p.id === 'hija-reta')!.rc.propioCents).toBe(
      antes.partidas.find((p) => p.id === 'hija-reta')!.rc.propioCents,
    );

    // La cascada honestamente NO debe reclamar "→ balance" aquí.
    const cascada = detectarCascada({ tipo: 'parametro', clave: 'cuota_media_autonomo', nombre: 'Cuota media de autónomo' }, antes, despues);
    expect(cascada.huboCambio).toBe(true);
    expect(cascada.balanceActual).toBeNull();
    expect(cascada.cadenaTexto).toContain('Número de autónomos');
    expect(cascada.cadenaTexto).toContain('elasticidad');
    expect(cascada.cadenaTexto).toContain('balance no se mueve');
    // eslint-disable-next-line no-console
    console.log('Cadena (cuota):', cascada.cadenaTexto);
    // eslint-disable-next-line no-console
    console.log('RETA actual antes/después:', formatoEuros(retaAntes), '→', formatoEuros(retaDespues), '(caída lineal habría sido', formatoEuros(caidaLineal), ')');
  });

  it('mover una partida raíz palanca (Pensiones) SÍ mueve el balance actual, pero no el RC (rc_cents explícito)', () => {
    const antes = resolver(parametros, partidas);
    const despues = resolver(parametros, partidas, { partidas: { 'root-pensiones': 17000000000000 } });

    expect(despues.balance.actualCents).not.toBe(antes.balance.actualCents);
    expect(despues.balance.rcCents).toBe(antes.balance.rcCents);

    const cascada = detectarCascada({ tipo: 'partida', id: 'root-pensiones', nombre: 'Pensiones' }, antes, despues);
    expect(cascada.huboCambio).toBe(true);
    expect(cascada.balanceActual).not.toBeNull();
    expect(cascada.balanceRC).toBeNull();
    expect(cascada.cadenaTexto).toContain('balance');
    expect(cascada.cadenaTexto).not.toContain('no se mueve');
    // eslint-disable-next-line no-console
    console.log('Cadena (pensiones):', cascada.cadenaTexto);
  });

  it('no reportar cascada si el valor no cambia realmente (mismo valor re-emitido)', () => {
    const antes = resolver(parametros, partidas);
    const despues = resolver(parametros, partidas, { parametros: { cuota_media_autonomo: 3600 } }); // idéntico al base
    const cascada = detectarCascada({ tipo: 'parametro', clave: 'cuota_media_autonomo', nombre: 'Cuota media de autónomo' }, antes, despues);
    expect(cascada.huboCambio).toBe(false);
    expect(cascada.cadenaTexto).toBe('');
  });
});
