'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/Input';
import { invitarUsuario, type ResultadoInvitacion } from './actions';

const etiqueta = 'mb-1 block text-[12px] font-bold text-gris';
const control = 'w-full rounded-boton border border-linea bg-white px-3 py-3 text-[14px]';

export function NuevoUsuarioForm() {
  const [estado, accion, pendiente] = useActionState<ResultadoInvitacion | null, FormData>(
    invitarUsuario,
    null,
  );

  return (
    <div className="space-y-4">
      {estado?.error && (
        <p className="rounded-boton border border-magenta/40 bg-magenta/5 px-4 py-3 text-[13.5px] font-semibold text-magenta">
          {estado.error}
        </p>
      )}

      {estado?.ok && (
        <div className="space-y-2 rounded-boton border border-accion bg-accion/5 px-4 py-3 text-[13.5px]">
          <p className="font-bold text-titular">Invitación creada para {estado.email}.</p>
          <p className="text-cuerpo">
            {estado.emailEnviado
              ? 'Le hemos enviado un email para que active su cuenta y elija su contraseña.'
              : 'El email no pudo enviarse (SMTP sin configurar en el servidor). Comparte tú este enlace de activación con la persona:'}
          </p>
          {estado.enlace && (
            <div className="rounded-boton border border-linea bg-white p-2">
              <code className="block break-all text-[11.5px] text-cuerpo">{estado.enlace}</code>
            </div>
          )}
          <p className="text-[12.5px] text-gris">
            Puedes seguir en el{' '}
            <Link href="/admin/usuarios" className="font-semibold text-titular underline">
              listado de usuarios
            </Link>{' '}
            o invitar a otra persona con el formulario de abajo.
          </p>
        </div>
      )}

      <form action={accion} className="space-y-4" autoComplete="off">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={etiqueta} htmlFor="email">
              Email
            </label>
            <Input id="email" name="email" type="email" required placeholder="persona@ejemplo.com" />
          </div>
          <div>
            <label className={etiqueta} htmlFor="display_name">
              Nombre (opcional)
            </label>
            <Input id="display_name" name="display_name" placeholder="Nombre y apellidos" />
          </div>
        </div>

        <div>
          <label className={etiqueta} htmlFor="roleKey">
            Rol
          </label>
          <select id="roleKey" name="roleKey" defaultValue="admin" className={control}>
            <option value="">Sin rol (usuario normal)</option>
            <option value="editor">Editor (blog, cerebro)</option>
            <option value="admin">Administrador (acceso total)</option>
          </select>
          <p className="mt-1 text-[12px] text-gris">
            «Administrador» da acceso completo al panel. Asignar con cuidado.
          </p>
        </div>

        <button
          type="submit"
          disabled={pendiente}
          className="rounded-boton bg-accion px-6 py-3 text-[14px] font-bold text-white disabled:opacity-60"
        >
          {pendiente ? 'Enviando invitación…' : 'Crear cuenta e invitar'}
        </button>
      </form>
    </div>
  );
}
