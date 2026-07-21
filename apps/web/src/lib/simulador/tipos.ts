/**
 * lib/simulador/tipos.ts
 *
 * Tipos compartidos del motor del Simulador del Presupuesto del País
 * (docs/tecnico/simulador-pais.md §3). Reflejan el esquema de rc-02-datos
 * (`supabase/migrations/0029_simulador.sql`) SIN acoplar el motor a
 * Supabase: estas interfaces son los datos ya leídos de la tabla, en la
 * forma más simple posible (strings/numbers), para que `lib/simulador/`
 * siga siendo TypeScript puro, sin React ni cliente de BD.
 *
 * D-S4: las fórmulas operan en EUROS; el almacén de partidas es bigint en
 * CÉNTIMOS. Los campos `*_cents` de este módulo son siempre céntimos
 * (asumimos que llegan como `number` — a esta escala, decenas de miles de
 * millones de euros, siguen siendo enteros exactos en un `number` de JS,
 * muy por debajo de `Number.MAX_SAFE_INTEGER`).
 */

export type ModoValor = 'fijo' | 'formula';
export type ModoRC = 'fijo' | 'pct_actual' | 'formula';
export type TipoPartida = 'ingreso' | 'gasto';
export type Ambito = 'estatal' | 'autonomico' | 'local' | 'otro';

/** Entrada de `sim_parametros` (solo los campos que el motor necesita). */
export interface ParametroInput {
  clave: string;
  nombre: string;
  unidad: string | null;
  modo: ModoValor;
  formula: string | null;
  valor_actual: number | null;
  valor_rc: number | null;
  es_palanca: boolean;
  palanca_min: number | null;
  palanca_max: number | null;
}

/** Entrada de `sim_partidas` (solo los campos que el motor necesita). */
export interface PartidaInput {
  id: string;
  parent_id: string | null;
  tipo: TipoPartida;
  nombre: string;
  ambito?: Ambito;
  ministry_id?: number | null;
  color?: string | null;
  actual_modo: ModoValor;
  actual_cents: number | null;
  actual_formula: string | null;
  rc_modo: ModoRC;
  rc_cents: number | null;
  rc_pct: number | null;
  rc_formula: string | null;
  es_palanca: boolean;
  palanca_min: number | null; // céntimos
  palanca_max: number | null; // céntimos
}

/**
 * Palancas movidas (D-S7/D-S9). Reemplazan el valor "base" de un parámetro
 * fijo (en su unidad nativa) o el valor "propio" ya resuelto de una partida
 * (en céntimos), SOLO en el lado ACTUAL — ver justificación en resolver.ts.
 */
export interface Overrides {
  parametros?: Record<string, number>;
  partidas?: Record<string, number>;
}

export interface ParametroResueltoInfo {
  clave: string;
  nombre: string;
  unidad: string | null;
  modo: ModoValor;
  esPalanca: boolean;
  palancaMin: number | null;
  palancaMax: number | null;
  valorActual: number | null;
  valorRC: number | null;
  errorActual?: string;
  errorRC?: string;
}

export interface LadoPartidaResuelto {
  propioCents: number | null;
  hijosCents: number;
  sinDesglosarCents: number | null;
  descuadre: boolean;
  error?: string;
}

export interface PartidaResueltaInfo {
  id: string;
  parentId: string | null;
  tipo: TipoPartida;
  nombre: string;
  ambito?: Ambito;
  ministryId?: number | null;
  color?: string | null;
  esPalanca: boolean;
  palancaMinCents: number | null;
  palancaMaxCents: number | null;
  actual: LadoPartidaResuelto;
  rc: LadoPartidaResuelto;
}

export interface SinResolverEntry {
  tipo: 'partida' | 'parametro';
  id: string;
  nombre: string;
  lado: 'actual' | 'rc';
  error: string;
}

/** Modelo resuelto completo — serializable a JSON (D-S7: viaja al navegador). */
export interface ModeloResuelto {
  parametros: ParametroResueltoInfo[];
  partidas: PartidaResueltaInfo[];
  balance: {
    actualCents: number;
    rcCents: number;
  };
  raices: {
    ingresos: string[];
    gastos: string[];
  };
  sinResolver: SinResolverEntry[];
}
