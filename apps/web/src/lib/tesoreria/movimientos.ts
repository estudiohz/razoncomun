import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Libro de movimientos (T2). El acceso al RAW —con contraparte— lo controla la
 * RLS de 0023: solo admin/tesorería. Estas funciones se llaman siempre con el
 * cliente de sesión del usuario, nunca con service_role.
 */
export interface Movimiento {
  id: string;
  dated: string;
  description: string;
  amount_cents: number;
  direction: 'in' | 'out';
  currency: string;
  category: string | null;
  counterparty_name: string | null;
  counterparty_ref: string | null;
  import_batch: string;
  source: string;
  published: boolean;
  edited_at: string | null;
  created_at: string;
}

export const POR_PAGINA = 25;

export interface FiltrosLibro {
  q?: string;
  direccion?: 'in' | 'out';
  categoria?: string;
  publicado?: 'si' | 'no';
  orden?: 'fecha_desc' | 'fecha_asc' | 'importe_desc' | 'importe_asc';
  pagina?: number;
}

export async function listarMovimientos(
  supabase: SupabaseClient,
  f: FiltrosLibro,
): Promise<{ filas: Movimiento[]; total: number }> {
  const pagina = Math.max(1, f.pagina ?? 1);
  const desde = (pagina - 1) * POR_PAGINA;

  let query = supabase.from('finance_movements').select('*', { count: 'exact' });

  if (f.q) {
    // La búsqueda incluye la contraparte a propósito: es la herramienta de
    // tesorería para localizar "el recibo de Fulano". Nunca sale de aquí.
    const t = f.q.replace(/[%,]/g, '');
    query = query.or(`description.ilike.%${t}%,counterparty_name.ilike.%${t}%,category.ilike.%${t}%`);
  }
  if (f.direccion) query = query.eq('direction', f.direccion);
  if (f.categoria) query = query.eq('category', f.categoria);
  if (f.publicado) query = query.eq('published', f.publicado === 'si');

  switch (f.orden) {
    case 'fecha_asc':
      query = query.order('dated', { ascending: true });
      break;
    case 'importe_desc':
      query = query.order('amount_cents', { ascending: false });
      break;
    case 'importe_asc':
      query = query.order('amount_cents', { ascending: true });
      break;
    default:
      query = query.order('dated', { ascending: false });
  }

  const { data, count, error } = await query.range(desde, desde + POR_PAGINA - 1);
  if (error) throw error;

  return { filas: (data ?? []) as Movimiento[], total: count ?? 0 };
}

/** Categorías ya usadas, para el desplegable de filtros y el alta manual. */
export async function categoriasUsadas(supabase: SupabaseClient): Promise<string[]> {
  const { data } = await supabase
    .from('finance_movements')
    .select('category')
    .not('category', 'is', null)
    .limit(1000);
  return [...new Set((data ?? []).map((f) => f.category as string))].sort((a, b) =>
    a.localeCompare(b, 'es'),
  );
}

export interface ResumenTesoreria {
  ingresosMes: number;
  gastosMes: number;
  ingresosAnyo: number;
  gastosAnyo: number;
  /** Ingresos por mes de los últimos 12, para el gráfico. */
  serie: { mes: string; ingresos: number; gastos: number }[];
  sinPublicar: number;
}

/**
 * Resumen económico (T4). Se calcula en TS sobre los movimientos del año en
 * curso y los 12 meses previos: no se crea ninguna vista SQL nueva porque el
 * esquema es propiedad de rc-02 y esto no lo necesita.
 */
export async function resumen(supabase: SupabaseClient): Promise<ResumenTesoreria> {
  const hoy = new Date();
  const desde = new Date(hoy.getFullYear() - 1, hoy.getMonth(), 1);

  const { data } = await supabase
    .from('finance_movements')
    .select('dated, amount_cents, direction, published')
    .gte('dated', desde.toISOString().slice(0, 10))
    .limit(10000);

  const filas = (data ?? []) as Pick<
    Movimiento,
    'dated' | 'amount_cents' | 'direction' | 'published'
  >[];

  const claveMes = (d: string) => d.slice(0, 7);
  const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  const anyoActual = String(hoy.getFullYear());

  const porMes = new Map<string, { ingresos: number; gastos: number }>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    porMes.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, {
      ingresos: 0,
      gastos: 0,
    });
  }

  let ingresosMes = 0;
  let gastosMes = 0;
  let ingresosAnyo = 0;
  let gastosAnyo = 0;
  let sinPublicar = 0;

  for (const f of filas) {
    const mes = claveMes(f.dated);
    const bucket = porMes.get(mes);
    if (bucket) {
      if (f.direction === 'in') bucket.ingresos += f.amount_cents;
      else bucket.gastos += f.amount_cents;
    }
    if (mes === mesActual) {
      if (f.direction === 'in') ingresosMes += f.amount_cents;
      else gastosMes += f.amount_cents;
    }
    if (f.dated.startsWith(anyoActual)) {
      if (f.direction === 'in') ingresosAnyo += f.amount_cents;
      else gastosAnyo += f.amount_cents;
    }
    if (!f.published) sinPublicar++;
  }

  return {
    ingresosMes,
    gastosMes,
    ingresosAnyo,
    gastosAnyo,
    sinPublicar,
    serie: [...porMes.entries()].map(([mes, v]) => ({ mes, ...v })),
  };
}
