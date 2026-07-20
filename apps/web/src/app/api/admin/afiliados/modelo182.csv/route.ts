import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { stripeCliente } from '@/lib/stripe/config';
import { requireFinanzas } from '@/lib/afiliacion/acceso';
import { filasModelo182, csvModelo182 } from '@/lib/afiliacion/modelo182';

/**
 * Export de trabajo para el Modelo 182 (ver aviso legal en
 * lib/afiliacion/modelo182.ts). `?year=` opcional, por defecto el año
 * natural anterior (el caso de uso real: preparar la declaración de enero).
 */
export async function GET(request: Request) {
  await requireFinanzas(); // gate de acceso (admin o tesorero)

  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get('year');
  const year = yearParam ? Number(yearParam) : new Date().getUTCFullYear() - 1;

  if (!Number.isInteger(year) || year < 2020 || year > new Date().getUTCFullYear()) {
    return NextResponse.json({ error: 'Año inválido' }, { status: 400 });
  }

  const admin = createAdminClient();
  const stripe = stripeCliente();
  const filas = await filasModelo182(admin, stripe, year);
  const csv = csvModelo182(filas, year);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="razon-comun-modelo182-${year}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
