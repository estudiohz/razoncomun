import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cargarCarnet } from '@/lib/carnet/modelo';
import { generarCarnetPdf } from '@/lib/carnet/pdf';
import { carnetOperativo } from '@/lib/carnet/token';

/**
 * Descarga del carnet en PDF. CON SESIÓN, siempre (D-C6).
 *
 * Se genera al vuelo en cada petición (D-C7): no hay fichero guardado que se
 * quede obsoleto, y el coste de dibujarlo es despreciable frente al lío de
 * mantener sincronizada una copia con el nombre y el nivel de la persona.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  if (!carnetOperativo()) {
    return NextResponse.json({ error: 'El carnet aún no está configurado.' }, { status: 503 });
  }

  const resultado = await cargarCarnet(supabase, user.id);
  if ('motivo' in resultado) {
    return NextResponse.json({ error: 'No tienes carnet', motivo: resultado.motivo }, { status: 403 });
  }

  const pdf = await generarCarnetPdf(resultado.carnet);

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="carnet-socio-${resultado.carnet.numeroSocio}.pdf"`,
      // Un carnet no se cachea: si la persona se verifica o se da de baja, la
      // siguiente descarga tiene que reflejarlo.
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
