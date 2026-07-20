'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/Input';

type Estado = { tipo: 'cargando' | 'listo' | 'verificando' | 'error' | 'sin_factor'; mensaje?: string };

/**
 * Reto de 2FA post-login (aal1 → aal2). Se usa tanto tras entrar con
 * contraseña/enlace mágico como cuando el middleware redirige aquí antes de
 * /admin. No hace falta email/contraseña de nuevo: la sesión aal1 ya existe,
 * solo falta completar el segundo factor.
 */
export function Desafio2FA({ next }: { next: string }) {
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [codigo, setCodigo] = useState('');
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase.auth.mfa.listFactors();
      const factor = data?.totp.find((f) => f.status === 'verified');
      if (error || !factor) {
        setEstado({ tipo: 'sin_factor' });
        return;
      }
      setFactorId(factor.id);
      const { data: reto, error: errorReto } = await supabase.auth.mfa.challenge({
        factorId: factor.id,
      });
      if (errorReto || !reto) {
        setEstado({ tipo: 'error', mensaje: 'No hemos podido iniciar el reto de verificación.' });
        return;
      }
      setChallengeId(reto.id);
      setEstado({ tipo: 'listo' });
    })();
  }, []);

  async function verificar(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId || !challengeId) return;
    setEstado({ tipo: 'verificando' });
    const supabase = createClient();
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId, code: codigo });
    if (error) {
      setEstado({ tipo: 'error', mensaje: 'Código incorrecto o caducado. Prueba con el código actual.' });
      return;
    }
    router.push(next);
    router.refresh();
  }

  if (estado.tipo === 'cargando') {
    return <p className="text-center text-[14px] text-gris">Comprobando tu segundo factor…</p>;
  }

  if (estado.tipo === 'sin_factor') {
    return (
      <p className="text-center text-[14px] text-cuerpo">
        Esta cuenta necesita 2FA para esta acción pero no tiene ningún factor activo. Contacta con
        administración.
      </p>
    );
  }

  return (
    <form onSubmit={verificar} className="space-y-4">
      <div>
        <label htmlFor="codigo" className="mb-1.5 block text-[13.5px] font-semibold text-titular">
          Código de 6 dígitos
        </label>
        <Input
          id="codigo"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          autoFocus
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
          placeholder="123456"
          className="text-center text-[22px] tracking-[0.4em]"
        />
      </div>
      {estado.tipo === 'error' && (
        <p className="rounded-boton bg-magenta/10 px-3.5 py-2.5 text-[13px] font-medium text-magenta">
          {estado.mensaje}
        </p>
      )}
      <button
        type="submit"
        disabled={codigo.length !== 6 || estado.tipo === 'verificando'}
        className="w-full rounded-boton bg-accion px-6 py-3 text-[15px] font-bold text-white shadow-boton transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {estado.tipo === 'verificando' ? 'Verificando…' : 'Verificar y continuar'}
      </button>
    </form>
  );
}
