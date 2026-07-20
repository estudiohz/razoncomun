'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/Input';
import { Boton } from '@/components/ui/Boton';
import { cn } from '@/lib/cn';
import { TEXTO_CONSENTIMIENTO } from '@/lib/auth/consentimiento';
import { METADATA_ALTA } from '@/lib/auth/alta';

const OAUTH_GOOGLE_ACTIVO = process.env.NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED === 'true';
const OAUTH_FACEBOOK_ACTIVO = process.env.NEXT_PUBLIC_OAUTH_FACEBOOK_ENABLED === 'true';

type Modo = 'password' | 'magico';
type Estado = { tipo: 'idle' | 'enviando' | 'ok' | 'error'; mensaje?: string };

export function RegistroForm() {
  const [modo, setModo] = useState<Modo>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [nombre, setNombre] = useState('');
  const [newsletter, setNewsletter] = useState(false);
  const [consiente, setConsiente] = useState(false);
  const [estado, setEstado] = useState<Estado>({ tipo: 'idle' });

  const puedeEnviar = consiente && email.length > 3 && estado.tipo !== 'enviando';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!consiente) {
      setEstado({ tipo: 'error', mensaje: 'Tienes que marcar la casilla de consentimiento para continuar.' });
      return;
    }
    if (modo === 'password' && password.length < 8) {
      setEstado({ tipo: 'error', mensaje: 'La contraseña debe tener al menos 8 caracteres.' });
      return;
    }
    if (modo === 'password' && password !== password2) {
      setEstado({ tipo: 'error', mensaje: 'Las dos contraseñas no coinciden.' });
      return;
    }

    setEstado({ tipo: 'enviando' });
    const supabase = createClient();
    const emailRedirectTo = `${window.location.origin}/auth/confirm?next=%2Fperfil`;
    const data = {
      [METADATA_ALTA.consentimiento]: true,
      [METADATA_ALTA.newsletter]: newsletter,
      ...(nombre ? { [METADATA_ALTA.nombre]: nombre } : {}),
    };

    const { error } =
      modo === 'password'
        ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo, data } })
        : await supabase.auth.signInWithOtp({
            email,
            options: { emailRedirectTo, shouldCreateUser: true, data },
          });

    if (error) {
      setEstado({ tipo: 'error', mensaje: traducirError(error.message) });
      return;
    }

    setEstado({
      tipo: 'ok',
      mensaje:
        'Te hemos enviado un correo. Ábrelo y sigue el enlace para confirmar tu cuenta (revisa también spam).',
    });
  }

  if (estado.tipo === 'ok') {
    return (
      <div className="text-center">
        <p className="text-[15px] text-cuerpo">{estado.mensaje}</p>
        <p className="mt-4 text-[13px] text-gris">
          Enviado a <strong>{email}</strong>.
        </p>
      </div>
    );
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
          placeholder="tu@email.com"
        />
      </div>

      {modo === 'password' && (
        <>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-[13.5px] font-semibold text-titular">
              Contraseña
            </label>
            <Input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
            />
          </div>
          <div>
            <label htmlFor="password2" className="mb-1.5 block text-[13.5px] font-semibold text-titular">
              Repite la contraseña
            </label>
            <Input
              id="password2"
              type="password"
              required
              autoComplete="new-password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
            />
          </div>
        </>
      )}

      <div>
        <label htmlFor="nombre" className="mb-1.5 block text-[13.5px] font-semibold text-titular">
          Nombre a mostrar <span className="font-normal text-gris">(opcional)</span>
        </label>
        <Input
          id="nombre"
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Como quieres que te veamos"
        />
      </div>

      <label className="flex items-start gap-2.5 text-[13px] text-cuerpo">
        <input
          type="checkbox"
          checked={newsletter}
          onChange={(e) => setNewsletter(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-linea text-accion focus:ring-titular/30"
        />
        <span>Quiero recibir la newsletter con novedades del partido.</span>
      </label>

      <label className="flex items-start gap-2.5 rounded-boton border border-linea bg-fondo p-3.5 text-[12.5px] leading-relaxed text-cuerpo">
        <input
          type="checkbox"
          required
          checked={consiente}
          onChange={(e) => setConsiente(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-linea text-accion focus:ring-titular/30"
        />
        <span>
          {TEXTO_CONSENTIMIENTO}{' '}
          <Link href="/privacidad" className="font-semibold text-titular underline">
            Leer política de privacidad
          </Link>
          .
        </span>
      </label>

      {estado.tipo === 'error' && (
        <p className="rounded-boton bg-magenta/10 px-3.5 py-2.5 text-[13px] font-medium text-magenta">
          {estado.mensaje}
        </p>
      )}

      <button
        type="submit"
        disabled={!puedeEnviar}
        className={cn(
          'w-full rounded-boton bg-accion px-6 py-3 text-[15px] font-bold text-white shadow-boton transition-transform',
          puedeEnviar ? 'hover:-translate-y-0.5' : 'cursor-not-allowed opacity-50',
        )}
      >
        {estado.tipo === 'enviando' ? 'Enviando…' : modo === 'password' ? 'Crear cuenta' : 'Enviarme el enlace'}
      </button>

      <div className="flex items-center gap-3 py-1">
        <div className="h-px flex-1 bg-linea" />
        <span className="text-[12px] text-gris">o continúa con</span>
        <div className="h-px flex-1 bg-linea" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <BotonOAuth
          proveedor="google"
          activo={OAUTH_GOOGLE_ACTIVO}
          habilitadoPorConsentimiento={consiente}
        >
          Google
        </BotonOAuth>
        <BotonOAuth
          proveedor="facebook"
          activo={OAUTH_FACEBOOK_ACTIVO}
          habilitadoPorConsentimiento={consiente}
        >
          Facebook
        </BotonOAuth>
      </div>

      <p className="pt-2 text-center text-[13px] text-cuerpo">
        ¿Ya tienes cuenta?{' '}
        <Link href="/entrar" className="font-semibold text-titular underline">
          Entra aquí
        </Link>
      </p>
    </form>
  );
}

function BotonOAuth({
  proveedor,
  activo,
  habilitadoPorConsentimiento,
  children,
}: {
  proveedor: 'google' | 'facebook';
  activo: boolean;
  habilitadoPorConsentimiento: boolean;
  children: string;
}) {
  const [cargando, setCargando] = useState(false);
  const habilitado = activo && habilitadoPorConsentimiento && !cargando;

  async function entrar() {
    if (!habilitado) return;
    setCargando(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: proveedor,
      options: { redirectTo: `${window.location.origin}/auth/callback?next=%2Fperfil` },
    });
  }

  return (
    <button
      type="button"
      onClick={entrar}
      disabled={!habilitado}
      title={
        !activo
          ? 'Próximamente: pendiente de que Sergio cree la app OAuth (ver AUTH-SETUP.md)'
          : !habilitadoPorConsentimiento
            ? 'Marca antes la casilla de consentimiento'
            : undefined
      }
      className={cn(
        'rounded-boton border border-linea bg-white px-4 py-2.5 text-[13.5px] font-semibold text-cuerpo transition-colors',
        habilitado ? 'hover:border-titular hover:text-titular' : 'cursor-not-allowed opacity-40',
      )}
    >
      {children}
      {!activo && <span className="ml-1 text-[11px] text-gris">(pronto)</span>}
    </button>
  );
}

function traducirError(mensaje: string): string {
  const m = mensaje.toLowerCase();
  if (m.includes('password') && m.includes('least')) return 'La contraseña es demasiado corta (mínimo 8 caracteres).';
  if (m.includes('rate limit')) return 'Demasiados intentos seguidos. Espera unos minutos y vuelve a intentarlo.';
  if (m.includes('email') && m.includes('invalid')) return 'Ese email no parece válido.';
  return 'No hemos podido completar el registro. Inténtalo de nuevo en unos minutos.';
}
