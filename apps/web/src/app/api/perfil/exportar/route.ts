import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Exportación de datos propios (RGPD, derecho de portabilidad). Alcance:
 * lo que es propiedad de Identidad/Auth (profiles, members propios,
 * cargos propios, factores 2FA, metadatos de la cuenta de auth). Datos de
 * participación (votos, propuestas) son de rc-06/rc-07 — quedan fuera a
 * propósito, se puede ampliar este endpoint cuando ese módulo exista.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const [{ data: perfil }, { data: miembros }, { data: cargos }, { data: factores }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('members').select('*').eq('user_id', user.id),
    supabase.from('positions').select('*').eq('user_id', user.id),
    supabase.auth.mfa.listFactors(),
  ]);

  const exportacion = {
    generado_en: new Date().toISOString(),
    cuenta: {
      id: user.id,
      email: user.email,
      creado_en: user.created_at,
      ultimo_acceso: user.last_sign_in_at,
      proveedores: user.app_metadata?.providers ?? [],
    },
    perfil,
    afiliacion: miembros ?? [],
    cargos_organicos: cargos ?? [],
    factores_2fa:
      factores?.totp?.map((f) => ({ id: f.id, estado: f.status, alta: f.created_at })) ?? [],
    nota: 'Exportación parcial: los datos de participación (votos, propuestas, encuestas) se añadirán cuando ese módulo esté disponible.',
  };

  return NextResponse.json(exportacion, {
    headers: {
      'Content-Disposition': `attachment; filename="razoncomun-mis-datos-${user.id}.json"`,
    },
  });
}
