'use server';

/**
 * lib/simulador/adminActions.ts
 *
 * Server actions de `/admin/presupuesto` (docs/tecnico/simulador-pais.md
 * §5). Guard `requireAdminOrEditor()` (patrón existente de `lib/admin/
 * guard.ts`) en cada acción — la sesión del usuario corre las queries, así
 * que la RLS de `sim_parametros`/`sim_partidas` (`is_editor()`) es la
 * última autoridad real; esto es solo la UX de validar ANTES de intentar
 * escribir (D-S8): toda fórmula se parsea y evalúa en seco con el motor
 * ANTES de guardar, y un parámetro derivado además pasa la detección de
 * ciclos — reutilizando `lib/simulador/validacion.ts`, cero lógica
 * duplicada.
 */

import { revalidatePath } from 'next/cache';
import { requireAdminOrEditor } from '@/lib/admin/guard';
import { listarParametros, listarPartidas, subarbol, type PartidaRow } from './adminData';
import { eurosACents } from './formato';
import type { Ambito, ModoRC, ModoValor, TipoPartida } from './tipos';
import { dondeSeUsaParametro, puedePublicar, validarFormulaParametroDerivado, validarFormulaPartida } from './validacion';

export interface ResultadoAccion {
  ok: boolean;
  error?: string;
  id?: string;
}

function texto(fd: FormData, campo: string): string {
  return String(fd.get(campo) ?? '').trim();
}

function numeroOpcional(fd: FormData, campo: string): number | null {
  const v = texto(fd, campo);
  if (v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function revalidarPresupuesto() {
  revalidatePath('/admin/presupuesto');
  revalidatePath('/admin/presupuesto/parametros');
  revalidatePath('/pais');
}

// ============================================================================
// Partidas
// ============================================================================

/** Crea o actualiza una partida (raíz o hija — el `parent_id` decide). */
export async function guardarPartidaAction(formData: FormData): Promise<ResultadoAccion> {
  const { supabase } = await requireAdminOrEditor('/admin/presupuesto');

  const id = texto(formData, 'id') || null;
  const nombre = texto(formData, 'nombre');
  if (!nombre) return { ok: false, error: 'El nombre es obligatorio.' };

  const parentIdRaw = texto(formData, 'parent_id');
  const parentId = parentIdRaw || null;

  let tipo = texto(formData, 'tipo') as TipoPartida;
  const partidas = await listarPartidas(supabase);

  if (parentId) {
    const padre = partidas.find((p) => p.id === parentId);
    if (!padre) return { ok: false, error: 'La partida "bajo la que" quieres colgar esta no existe.' };
    tipo = padre.tipo; // una hija hereda SIEMPRE el tipo de su padre (D-S1: no se mezclan árboles)

    // Defensa en profundidad contra un ciclo en el árbol (el desplegable del
    // editor ya excluye estas opciones, pero un POST directo no pasa por
    // ahí): no te puedes colgar de ti mismo ni de tu propio descendiente.
    if (id) {
      if (parentId === id) {
        return { ok: false, error: 'Una partida no puede ser su propio padre.' };
      }
      const descendientes = subarbol(partidas, id);
      if (descendientes.some((d) => d.id === parentId)) {
        return { ok: false, error: 'No puedes colgar una partida bajo su propia subpartida (crearía un ciclo).' };
      }
    }
  }
  if (tipo !== 'ingreso' && tipo !== 'gasto') {
    return { ok: false, error: 'Falta indicar si es ingreso o gasto.' };
  }

  const ambito = (texto(formData, 'ambito') || 'estatal') as Ambito;

  const actualModo = texto(formData, 'actual_modo') as ModoValor;
  let actualCents: number | null = null;
  let actualFormula: string | null = null;
  if (actualModo === 'fijo') {
    actualCents = eurosACents(numeroOpcional(formData, 'actual_valor_euros'));
    if (actualCents === null) return { ok: false, error: 'El valor actual (fijo) es obligatorio.' };
  } else if (actualModo === 'formula') {
    actualFormula = texto(formData, 'actual_formula') || null;
    if (!actualFormula) return { ok: false, error: 'La fórmula del valor actual es obligatoria.' };
  } else {
    return { ok: false, error: 'Modo del valor actual no válido.' };
  }

  const fuenteActual = texto(formData, 'fuente_actual') || null;

  const parametros = await listarParametros(supabase);

  if (actualFormula) {
    const v = validarFormulaPartida(actualFormula, parametros);
    if (!v.ok) return { ok: false, error: `Fórmula del valor actual inválida: ${v.error}` };
  }

  const rcModo = texto(formData, 'rc_modo') as ModoRC;
  let rcCents: number | null = null;
  let rcPct: number | null = null;
  let rcFormula: string | null = null;
  if (rcModo === 'fijo') {
    rcCents = eurosACents(numeroOpcional(formData, 'rc_valor_euros')); // puede quedar null = "hereda el actual"
  } else if (rcModo === 'pct_actual') {
    rcPct = numeroOpcional(formData, 'rc_pct');
    if (rcPct === null) return { ok: false, error: 'El porcentaje de Razón Común es obligatorio en modo "% sobre el actual".' };
  } else if (rcModo === 'formula') {
    rcFormula = texto(formData, 'rc_formula') || null;
    if (!rcFormula) return { ok: false, error: 'La fórmula del valor de Razón Común es obligatoria.' };
    const v = validarFormulaPartida(rcFormula, parametros);
    if (!v.ok) return { ok: false, error: `Fórmula del valor de Razón Común inválida: ${v.error}` };
  } else {
    return { ok: false, error: 'Modo del valor de Razón Común no válido.' };
  }

  const justificacionRc = texto(formData, 'justificacion_rc') || null;
  const ministryIdRaw = texto(formData, 'ministry_id');
  const ministryId = ministryIdRaw ? Number(ministryIdRaw) : null;

  const esPalanca = formData.get('es_palanca') === 'on';
  let palancaMin: number | null = null;
  let palancaMax: number | null = null;
  if (esPalanca) {
    palancaMin = eurosACents(numeroOpcional(formData, 'palanca_min_euros'));
    palancaMax = eurosACents(numeroOpcional(formData, 'palanca_max_euros'));
    if (palancaMin === null || palancaMax === null) {
      return { ok: false, error: 'Una palanca necesita mínimo y máximo.' };
    }
    if (palancaMin > palancaMax) {
      return { ok: false, error: 'El mínimo de la palanca no puede ser mayor que el máximo.' };
    }
  }

  const color = texto(formData, 'color') || null;

  const fila = {
    parent_id: parentId,
    tipo,
    nombre,
    ambito,
    actual_modo: actualModo,
    actual_cents: actualCents,
    actual_formula: actualFormula,
    fuente_actual: fuenteActual,
    rc_modo: rcModo,
    rc_cents: rcCents,
    rc_pct: rcPct,
    rc_formula: rcFormula,
    justificacion_rc: justificacionRc,
    ministry_id: ministryId,
    es_palanca: esPalanca,
    palanca_min: palancaMin,
    palanca_max: palancaMax,
    color,
  };

  try {
    if (id) {
      const { error } = await supabase.from('sim_partidas').update(fila).eq('id', id);
      if (error) return { ok: false, error: error.message };
      revalidarPresupuesto();
      return { ok: true, id };
    }

    const nuevoId = globalThis.crypto.randomUUID();
    const { error } = await supabase.from('sim_partidas').insert({ id: nuevoId, ...fila });
    if (error) return { ok: false, error: error.message };
    revalidarPresupuesto();
    return { ok: true, id: nuevoId };
  } catch {
    return { ok: false, error: 'No se ha podido guardar (error de red o servidor). Inténtalo de nuevo.' };
  }
}

export async function eliminarPartidaAction(id: string): Promise<ResultadoAccion> {
  const { supabase } = await requireAdminOrEditor('/admin/presupuesto');

  const todas = await listarPartidas(supabase);
  const hijas = todas.filter((p) => p.parent_id === id);
  if (hijas.length > 0) {
    return {
      ok: false,
      error: `No se puede borrar: tiene ${hijas.length} subpartida${hijas.length === 1 ? '' : 's'} (${hijas
        .map((h) => h.nombre)
        .slice(0, 5)
        .join(', ')}${hijas.length > 5 ? '…' : ''}). Bórralas antes, o muévelas a otro padre.`,
    };
  }

  try {
    const { error } = await supabase.from('sim_partidas').delete().eq('id', id);
    if (error) return { ok: false, error: error.message };
    revalidarPresupuesto();
    return { ok: true };
  } catch {
    return { ok: false, error: 'No se ha podido borrar (error de red o servidor).' };
  }
}

export async function publicarPartidaAction(id: string, publicar: boolean): Promise<ResultadoAccion> {
  const { supabase } = await requireAdminOrEditor('/admin/presupuesto');

  if (publicar) {
    const { data } = await supabase.from('sim_partidas').select('fuente_actual').eq('id', id).maybeSingle();
    const v = puedePublicar(data?.fuente_actual);
    if (!v.ok) return v;
  }

  const { error } = await supabase.from('sim_partidas').update({ publicado: publicar }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidarPresupuesto();
  return { ok: true };
}

// ============================================================================
// Parámetros
// ============================================================================

const CLAVE_SLUG = /^[a-z][a-z0-9_]*$/;

export async function guardarParametroAction(formData: FormData): Promise<ResultadoAccion> {
  const { supabase } = await requireAdminOrEditor('/admin/presupuesto/parametros');

  const id = texto(formData, 'id') || null;
  const clave = texto(formData, 'clave');
  const nombre = texto(formData, 'nombre');
  if (!clave || !CLAVE_SLUG.test(clave)) {
    return { ok: false, error: 'La clave debe ser un slug: minúsculas, números y guiones bajos, empezando por una letra.' };
  }
  if (!nombre) return { ok: false, error: 'El nombre es obligatorio.' };

  const unidad = texto(formData, 'unidad') || null;
  const modo = texto(formData, 'modo') as ModoValor;
  const esPalanca = formData.get('es_palanca') === 'on';

  const parametros = await listarParametros(supabase);
  // Otra fila con la misma clave (que no sea esta al editar) — la BD también
  // lo rechazaría (unique), pero un mensaje claro aquí evita el error crudo.
  const choque = parametros.find((p) => p.clave === clave && p.id !== id);
  if (choque) return { ok: false, error: `Ya existe un parámetro con la clave "${clave}".` };

  let valorActual: number | null = null;
  let formula: string | null = null;

  if (modo === 'fijo') {
    valorActual = numeroOpcional(formData, 'valor_actual');
    if (valorActual === null) return { ok: false, error: 'El valor actual es obligatorio en modo fijo.' };
  } else if (modo === 'formula') {
    if (esPalanca) {
      return { ok: false, error: 'Un parámetro derivado (fórmula) no puede ser palanca (D-S2b).' };
    }
    formula = texto(formData, 'formula') || null;
    if (!formula) return { ok: false, error: 'La fórmula es obligatoria en modo derivado.' };
    const v = validarFormulaParametroDerivado(clave, formula, parametros);
    if (!v.ok) return { ok: false, error: v.error };
  } else {
    return { ok: false, error: 'Modo no válido.' };
  }

  const fuenteActual = texto(formData, 'fuente_actual') || null;
  const valorRc = numeroOpcional(formData, 'valor_rc');
  const notaRc = texto(formData, 'nota_rc') || null;

  let palancaMin: number | null = null;
  let palancaMax: number | null = null;
  if (esPalanca) {
    palancaMin = numeroOpcional(formData, 'palanca_min');
    palancaMax = numeroOpcional(formData, 'palanca_max');
    if (palancaMin === null || palancaMax === null) {
      return { ok: false, error: 'Una palanca necesita mínimo y máximo.' };
    }
    if (palancaMin > palancaMax) {
      return { ok: false, error: 'El mínimo de la palanca no puede ser mayor que el máximo.' };
    }
  }

  const fila = {
    clave,
    nombre,
    unidad,
    modo,
    formula,
    valor_actual: valorActual,
    fuente_actual: fuenteActual,
    valor_rc: valorRc,
    nota_rc: notaRc,
    es_palanca: esPalanca,
    palanca_min: palancaMin,
    palanca_max: palancaMax,
  };

  try {
    if (id) {
      const { error } = await supabase.from('sim_parametros').update(fila).eq('id', id);
      if (error) return { ok: false, error: error.message };
      revalidarPresupuesto();
      return { ok: true, id };
    }
    const nuevoId = globalThis.crypto.randomUUID();
    const { error } = await supabase.from('sim_parametros').insert({ id: nuevoId, ...fila });
    if (error) return { ok: false, error: error.message };
    revalidarPresupuesto();
    return { ok: true, id: nuevoId };
  } catch {
    return { ok: false, error: 'No se ha podido guardar (error de red o servidor). Inténtalo de nuevo.' };
  }
}

export async function eliminarParametroAction(id: string): Promise<ResultadoAccion> {
  const { supabase } = await requireAdminOrEditor('/admin/presupuesto/parametros');

  const parametros = await listarParametros(supabase);
  const partidas = await listarPartidas(supabase);
  const objetivo = parametros.find((p) => p.id === id);
  if (!objetivo) return { ok: false, error: 'Ese parámetro ya no existe.' };

  const referencias = dondeSeUsaParametro(objetivo.clave, parametros, partidas);
  if (referencias.length > 0) {
    const lista = referencias
      .slice(0, 6)
      .map((r) => `${r.nombre} (${r.tipo === 'parametro' ? 'parámetro derivado' : r.tipo === 'partida_actual' ? 'partida, lado actual' : 'partida, lado RC'})`)
      .join(', ');
    return {
      ok: false,
      error: `No se puede borrar: "${objetivo.clave}" se usa en ${referencias.length} fórmula${referencias.length === 1 ? '' : 's'}: ${lista}${referencias.length > 6 ? '…' : ''}.`,
    };
  }

  try {
    const { error } = await supabase.from('sim_parametros').delete().eq('id', id);
    if (error) return { ok: false, error: error.message };
    revalidarPresupuesto();
    return { ok: true };
  } catch {
    return { ok: false, error: 'No se ha podido borrar (error de red o servidor).' };
  }
}

export async function publicarParametroAction(id: string, publicar: boolean): Promise<ResultadoAccion> {
  const { supabase } = await requireAdminOrEditor('/admin/presupuesto/parametros');

  if (publicar) {
    const { data } = await supabase.from('sim_parametros').select('fuente_actual').eq('id', id).maybeSingle();
    const v = puedePublicar(data?.fuente_actual);
    if (!v.ok) return v;
  }

  const { error } = await supabase.from('sim_parametros').update({ publicado: publicar }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidarPresupuesto();
  return { ok: true };
}

export type { PartidaRow };
