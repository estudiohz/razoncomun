import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Histórico descargable de `/cuentas` (docs/tecnico/afiliados-y-transparencia.md:
 * "histórico mensual descargable (CSV)"). Público — mismos datos agregados
 * que ya se ven en la página (RLS de `finance_snapshots`/`finance_expenses`
 * ya permite lectura a `anon`), solo en formato tabular para quien quiera
 * auditar con sus propias herramientas.
 */
export async function GET() {
  const supabase = await createClient();

  const [{ data: snapshots }, { data: gastos }] = await Promise.all([
    supabase.from('finance_snapshots').select('taken_at, balance_cents, income_month_cents, members_count').order('taken_at', { ascending: false }),
    supabase.from('finance_expenses').select('dated, concept, amount_cents, category').order('dated', { ascending: false }),
  ]);

  const lineas: string[] = [];
  lineas.push('# Razón Común — histórico de cuentas públicas');
  lineas.push('');
  lineas.push('tipo,fecha,concepto_o_metrica,categoria,importe_cents');

  for (const s of snapshots ?? []) {
    lineas.push(`snapshot,${s.taken_at},saldo_wise,,${s.balance_cents}`);
    lineas.push(`snapshot,${s.taken_at},ingresos_mes,,${s.income_month_cents}`);
    lineas.push(`snapshot,${s.taken_at},num_afiliados_cuota,,${s.members_count}`);
  }
  for (const g of gastos ?? []) {
    const concepto = `"${g.concept.replace(/"/g, '""')}"`;
    lineas.push(`gasto,${g.dated},${concepto},${g.category},${g.amount_cents}`);
  }

  const csv = '﻿' + lineas.join('\n'); // BOM: Excel en Windows respeta UTF-8 con acentos

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="razon-comun-cuentas.csv"',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
