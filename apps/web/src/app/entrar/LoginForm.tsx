'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/cn';

const OAUTH_GOOGLE_ACTIVO = process.env.NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED === 'true';
const OAUTH_FACEBOOK_ACTIVO = process.env.NEXT_PUBLIC_OAUTH_FACEBOOK_ENABLED === 'true';

type Modo = 'password' | 'magico';
type Estado = { tipo: 'idle' | 'enviando' | 'ok' | 'error'; mensaje?: string };

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [estado, setEstado] = useState<Estado>({ tipo: 'idle' });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setEstado({ tipo: 'enviando' });
    const supabase = createClient();

    if (modo === 'password') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setEstado({ tipo: 'error', mensaje: traducirError(error.message) });
        return;
      }
      // ¿Hace falta completar 2FA en esta sesión? (aal1 → aal2 pendiente)
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
        router.push(`/entrar/2fa?next=${encodeURIComponent(next)}`);
        return;
      }
      router.push(next);
      router.refresh();
      return;
    }

    const emailRedirectTo = `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo, shouldCreateUser: false },
    });
    if (error) {
      setEstado({ tipo: 'error', mensaje: traducirError(error.message) });
      return;
    }
    setEstado({ tipo: 'ok', mensaje: 'Te hemos enviado un enlace de acceso a tu correo.' });
  }

  if (estado.tipo === 'ok') {
    return <p className="text-center text-[15px] text-cuerpo">{estado.mensaje}</p>;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex gap-2 rounded-boton border border-linea bg-fondo p-1">
        <button
          type="button"
          onClick={() => setModo('password')}
          className={cn(
            'flex-1 rounded-[10px] py-2 text-[13.5px] font-semibold transition-colors',
            modo === 'password' ? 'bg-white text-titular shadow-nav' : 'text-cuerpo',
          )}
        >
          Con contraseña
        </button>
        <button
          type="button"
          onClick={() => setModo('magico')}
          className={cn(
            'flex-1 rounded-[10px] py-2 text-[13.5px] font-semibold transition-colors',
            modo === 'magico' ? 'bg-white text-titular shadow-nav' : 'text-cuerpo',
          )}
        >
          Enlace mágico
        </button>
      </div>

      <div>
        <label htmlFor="email" className="mb-1.5 block text-[13.5px] font-semibold text-titular">
          Email
        </label>
        <Input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      {modo === 'password' && (
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="password" className="text-[13.5px] font-semibold text-titular">
              Contraseña
            </label>
            <Link href="/recuperar" className="text-[12.5px] font-medium text-cuerpo underline">
              ¿La olvidaste?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      )}

      {estado.tipo === 'error' && (
        <p className="rounded-boton bg-magenta/10 px-3.5 py-2.5 text-[13px] font-medium text-magenta">
          {estado.mensaje}
        </p>
      )}

      <button
        type="submit"
        disabled={estado.tipo === 'enviando'}
        className="w-full rounded-boton bg-accion px-6 py-3 text-[15px] font-bold text-white shadow-boton transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {estado.tipo === 'enviando' ? 'Entrando…' : modo === 'password' ? 'Entrar' : 'Enviarme el enlace'}
      </button>

      <div className="flex items-center gap-3 py-1">
        <div className="h-px flex-1 bg-linea" />
        <span className="text-[12px] text-gris">o continúa con</span>
        <div className="h-px flex-1 bg-linea" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <BotonOAuth proveedor="google" activo={OAUTH_GOOGLE_ACTIVO} next={next}>
          Google
        </BotonOAuth>
        <BotonOAuth proveedor="facebook" activo={OAUTH_FACEBOOK_ACTIVO} next={next}>
          Facebook
        </BotonOAuth>
      </div>

      <p className="pt-2 text-center text-[13px] text-cuerpo">
        ¿Aún no tienes cuenta?{' '}
        <Link href="/registro" className="font-semibold text-titular underline">
          Regístrate
        </Link>
      </p>
    </form>
  );
}

function BotonOAuth({
  proveedor,
  activo,
  next,
  children,
}: {
  proveedor: 'google' | 'facebook';
  activo: boolean;
  next: string;
  children: string;
}) {
  async function entrar() {
    if (!activo) return;
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: proveedor,
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
  }

  return (
    <button
      type="button"
      onClick={entrar}
      disabled={!activo}
      title={!activo ? 'Próximamente: pendiente de credenciales OAuth (ver AUTH-SETUP.md)' : undefined}
      className={cn(
        'rounded-boton border border-linea bg-white px-4 py-2.5 text-[13.5px] font-semibold text-cuerpo transition-colors',
        activo ? 'hover:border-titular hover:text-titular' : 'cursor-not-allowed opacity-40',
      )}
    >
      {children}
      {!activo && <span className="ml-1 text-[11px] text-gris">(pronto)</span>}
    </button>
  );
}

function traducirError(mensaje: string): string {
  const m = mensaje.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Email o contraseña incorrectos.';
  if (m.includes('email not confirmed')) return 'Todavía no has confirmado tu email. Revisa tu bandeja de entrada.';
  if (m.includes('rate limit')) return 'Demasiados intentos seguidos. Espera unos minutos.';
  if (m.includes('signups not allowed')) return 'No existe una cuenta con ese email. ¿Quieres registrarte?';
  return 'No hemos podido iniciar sesión. Inténtalo de nuevo.';
}
