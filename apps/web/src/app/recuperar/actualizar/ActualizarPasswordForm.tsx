'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/Input';

type Estado = { tipo: 'idle' | 'enviando' | 'error'; mensaje?: string };

export function ActualizarPasswordForm({ next }: { next: string }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [estado, setEstado] = useState<Estado>({ tipo: 'idle' });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setEstado({ tipo: 'error', mensaje: 'La contraseña debe tener al menos 8 caracteres.' });
      return;
    }
    if (password !== password2) {
      setEstado({ tipo: 'error', mensaje: 'Las dos contraseñas no coinciden.' });
      return;
    }
    setEstado({ tipo: 'enviando' });
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setEstado({ tipo: 'error', mensaje: 'No hemos podido actualizar la contraseña. Inténtalo de nuevo.' });
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="password" className="mb-1.5 block text-[13.5px] font-semibold text-titular">
          Nueva contraseña
        </label>
        <Input
          id="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="password2" className="mb-1.5 block text-[13.5px] font-semibold text-titular">
          Repítela
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
        {estado.tipo === 'enviando' ? 'Guardando…' : 'Guardar contraseña'}
      </button>
    </form>
  );
}
