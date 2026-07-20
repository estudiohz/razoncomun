'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/cn';

type Estado = { tipo: 'idle' | 'enviando' | 'ok' | 'error'; mensaje?: string };

/**
 * Alta/cambio de contraseña desde /perfil. Mismo patrón que
 * /recuperar/actualizar/ActualizarPasswordForm.tsx (mínimo 8 caracteres,
 * password + confirmación), pero:
 * - se queda en la página (no hay `next`, no navega): feedback inline.
 * - sirve tanto para quien nunca tuvo contraseña (entra solo por enlace
 *   mágico) como para quien ya la tiene y quiere cambiarla — el copy y el
 *   texto del botón se adaptan según `tieneContrasenaInicial` (viene de
 *   `has_password()`, migración 0025, rc-02).
 *
 * Tras un guardado con éxito, además de reflejar el cambio en el propio
 * estado local (para que el copy cambie a "Cambiar contraseña" al momento),
 * se llama a router.refresh() para que el resto de Server Components de la
 * petición (el aviso global de Nav.tsx incluido) vuelvan a leer
 * has_password() y dejen de mostrar el banner.
 */
export function ContrasenaForm({ tieneContrasenaInicial }: { tieneContrasenaInicial: boolean }) {
  const router = useRouter();
  const [tieneContrasena, setTieneContrasena] = useState(tieneContrasenaInicial);
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
      setEstado({
        tipo: 'error',
        mensaje: 'No hemos podido guardar la contraseña. Inténtalo de nuevo.',
      });
      return;
    }
    setEstado({
      tipo: 'ok',
      mensaje: tieneContrasena
        ? 'Contraseña actualizada.'
        : 'Contraseña creada. Ya puedes entrar con ella, sin depender del enlace mágico.',
    });
    setTieneContrasena(true);
    setPassword('');
    setPassword2('');
    router.refresh();
  }

  return (
    <div id="contrasena" className="scroll-mt-28">
      {!tieneContrasena && (
        <p className="mb-4 text-[13.5px] text-cuerpo">
          Aún no tienes contraseña: entras con el enlace mágico que te enviamos por correo. Puedes
          crear una para entrar directamente, sin depender de ese enlace.
        </p>
      )}
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="password-perfil"
            className="mb-1.5 block text-[13.5px] font-semibold text-titular"
          >
            {tieneContrasena ? 'Nueva contraseña' : 'Elige una contraseña'}
          </label>
          <Input
            id="password-perfil"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div>
          <label
            htmlFor="password2-perfil"
            className="mb-1.5 block text-[13.5px] font-semibold text-titular"
          >
            Repítela
          </label>
          <Input
            id="password2-perfil"
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
        {estado.tipo === 'ok' && (
          <p className="rounded-boton bg-teal/10 px-3.5 py-2.5 text-[13px] font-medium text-titular">
            {estado.mensaje}
          </p>
        )}
        <button
          type="submit"
          disabled={estado.tipo === 'enviando'}
          className={cn(
            'w-full rounded-boton bg-accion px-6 py-3 text-[15px] font-bold text-white shadow-boton',
            'transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50',
            'min-[480px]:w-auto',
          )}
        >
          {estado.tipo === 'enviando'
            ? 'Guardando…'
            : tieneContrasena
              ? 'Cambiar contraseña'
              : 'Crear contraseña'}
        </button>
      </form>
    </div>
  );
}
