'use client';

import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/cn';

/** La "G" oficial multicolor (guías de identidad de Google Sign-In). */
export function IconoGoogle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={className ?? 'h-[18px] w-[18px]'}>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

/**
 * Botón "Entrar con Google" reutilizable (nav, burger, /entrar). Inicia el
 * flujo PKCE contra /auth/callback conservando el destino. El registro y el
 * login son el mismo gesto: si la cuenta no existe, GoTrue la crea y la
 * pasarela de consentimiento RGPD hace el resto — por eso este botón "motiva
 * el registro rápido" sin necesitar un formulario.
 */
export function BotonEntrarGoogle({
  next = '/panel',
  compacto = false,
  className,
}: {
  next?: string;
  /** true = versión de nav (más pequeña); false = botón de formulario. */
  compacto?: boolean;
  className?: string;
}) {
  async function entrar() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  }

  return (
    <button
      type="button"
      onClick={entrar}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-boton border border-linea bg-white font-semibold text-titular transition-colors hover:border-titular',
        compacto ? 'px-3.5 py-[7px] text-[13px]' : 'w-full px-4 py-2.5 text-[13.5px]',
        className,
      )}
    >
      <IconoGoogle className={compacto ? 'h-4 w-4' : 'h-[18px] w-[18px]'} />
      Entrar con Google
    </button>
  );
}
