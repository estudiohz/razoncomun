import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { stripeCliente } from '@/lib/stripe/config';
import { datosCertificado, generarCertificadoPDF } from '@/lib/afiliacion/certificado';

/**
 * Descarga del certificado fiscal anual (`/perfil` enlaza aquí). Requiere
 * sesión — cada afiliado solo puede pedir el suyo (no hay parámetro de
 * userId: siempre se calcula sobre `auth.getUser()` de la petición actual).
 * `?year=2025` opcional, por defecto el año natural anterior completo (el
 * caso de uso normal: "quiero el certificado del año pasado para la
 * declaración de la renta").
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get('year');
  const year = yearParam ? Number(yearParam) : new Date().getUTCFullYear() - 1;

  if (!Number.isInteger(year) || year < 2020 || year > new Date().getUTCFullYear()) {
    return NextResponse.json({ error: 'Año inválido' }, { status: 400 });
  }

  const admin = createAdminClient();
  const stripe = stripeCliente();

  const datos = await datosCertificado(admin, stripe, user.id, year);
  if (!datos) {
    return NextResponse.json(
      { error: `No hay cuotas cobradas en ${year} para generar un certificado.` },
      { status: 404 },
    );
  }

  const pdfBytes = await generarCertificadoPDF(datos);

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="certificado-cuotas-razon-comun-${year}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
