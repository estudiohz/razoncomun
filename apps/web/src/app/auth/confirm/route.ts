import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { aplicarMetadataAlta, destinoTrasVerificar } from '@/lib/auth/alta';

/**
 * Redime enlaces de email de Supabase Auth (confirmación de alta, magic
 * link, recuperación de contraseña, cambio de email, invitación). GoTrue
 * genera estos enlaces con `token_hash` + `type`; `verifyOtp` es la misma
 * llamada que hace el propio endpoint /auth/v1/verify de GoTrue, así que
 * este route handler cubre el camino real, no un atajo de test.
 *
 * IMPORTANTE (pendiente de infra, ver AUTH-SETUP.md §4): la plantilla de
 * email por defecto de GoTrue enlaza a `{API_EXTERNAL_URL}/auth/v1/verify`,
 * no a esta ruta. Para que el usuario real llegue aquí hace falta
 * personalizar las plantillas de correo (GOTRUE_MAILER_TEMPLATES_*) para que
 * apunten a `{SITE_URL}/auth/confirm?token_hash=...&type=...`. Mientras
 * tanto, este handler queda verificado con `verifyOtp` directamente
 * (idéntico resultado, sin la redirección intermedia de GoTrue) — ver
 * evidencia en el informe de cierre de ola.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') ?? '/perfil';

  if (token_hash && type) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash });

    if (!error && data.user) {
      await aplicarMetadataAlta(supabase, data.user);
      const destino = await destinoTrasVerificar(supabase, data.user.id, type, next);
      return NextResponse.redirect(`${origin}${destino}`);
    }
  }

  return NextResponse.redirect(`${origin}/entrar?error=enlace_invalido`);
}
