import { NextResponse } from 'next/server';
import { requireFinanzas } from '@/lib/afiliacion/acceso';

/** Export CSV del listado de afiliados — mismo filtro de acceso que el panel (admin/tesorero). */
export async function GET() {
  const { supabase } = await requireFinanzas();

  const { data: miembros } = await supabase
    .from('members')
    .select(
      'status, billing_period, amount_cents, payment_method, sepa_mandate_id, started_at, canceled_at, profiles(display_name, email, origin_province_id)',
    )
    .order('started_at', { ascending: false });

  const { data: provincias } = await supabase.from('territories').select('id, name').eq('type', 'province');
  const provinciaPorId = new Map((provincias ?? []).map((p) => [p.id, p.name]));

  const lineas: string[] = [];
  lineas.push('nombre,email,provincia,estado,periodo,cuota_eur,mandato_sepa,alta,baja');
  for (const m of miembros ?? []) {
    const perfil = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    const nombre = `"${(perfil?.display_name ?? '').replace(/"/g, '""')}"`;
    const provincia = perfil?.origin_province_id ? provinciaPorId.get(perfil.origin_province_id) ?? '' : '';
    lineas.push(
      [
        nombre,
        perfil?.email ?? '',
        provincia,
        m.status,
        m.billing_period ?? '',
        m.amount_cents != null ? (m.amount_cents / 100).toFixed(2) : '',
        m.sepa_mandate_id ?? '',
        m.started_at ?? '',
        m.canceled_at ?? '',
      ].join(','),
    );
  }

  const csv = '﻿' + lineas.join('\n');

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="razon-comun-afiliados.csv"',
      'Cache-Control': 'private, no-store',
    },
  });
}
