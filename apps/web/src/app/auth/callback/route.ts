import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { destinoTrasVerificar } from '@/lib/auth/alta';

/**
 * Callback de OAuth (Google/Facebook, PKCE: GoTrue redirige aquí con `?code=`).
 * Sin credenciales OAuth configuradas todavía (ver AUTH-SETUP.md) esta ruta
 * no es alcanzable en local, pero queda lista: en cuanto Sergio active un
 * proveedor, el flujo entra por aquí igual que el de email.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/perfil';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const destino = await destinoTrasVerificar(supabase, user.id, 'oauth', next);
        return NextResponse.redirect(`${origin}${destino}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/entrar?error=oauth_fallido`);
}
