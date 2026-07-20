'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/Input';

type Estado = { tipo: 'idle' | 'enviando' | 'ok' | 'error'; mensaje?: string };

export function RecuperarForm() {
  const [email, setEmail] = useState('');
  const [estado, setEstado] = useState<Estado>({ tipo: 'idle' });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setEstado({ tipo: 'enviando' });
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm?next=%2Fperfil`,
    });
    if (error) {
      setEstado({
        tipo: 'error',
        mensaje: error.message.toLowerCase().includes('rate limit')
          ? 'Demasiados intentos seguidos. Espera unos minutos.'
          : 'No hemos podido procesar la solicitud. Inténtalo de nuevo.',
      });
      return;
    }
    setEstado({
      tipo: 'ok',
      mensaje: 'Si ese email tiene una cuenta, te llegará un enlace para restablecer la contraseña.',
    });
  }

  if (estado.tipo === 'ok') {
    return <p className="text-center text-[15px] text-cuerpo">{estado.mensaje}</p>;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
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
        {estado.tipo === 'enviando' ? 'Enviando…' : 'Enviar enlace'}
      </button>
      <p className="pt-1 text-center text-[13px] text-cuerpo">
        <Link href="/entrar" className="font-semibold text-titular underline">
          Volver a entrar
        </Link>
      </p>
    </form>
  );
}
