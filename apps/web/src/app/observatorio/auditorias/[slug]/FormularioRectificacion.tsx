'use client';

import { useActionState } from 'react';
import { solicitarRectificacion, type EstadoRectificacion } from '../actions';

const control = 'w-full rounded-boton border border-linea bg-white px-3 py-2.5 text-[14px]';
const etiqueta = 'mb-1 block text-[12.5px] font-bold text-gris';

export function FormularioRectificacion({ slug, pregunta, token }: { slug: string; pregunta: string; token: string }) {
  const [estado, enviar, pendiente] = useActionState<EstadoRectificacion, FormData>(solicitarRectificacion, null);

  if (estado && 'ok' in estado) {
    return (
      <p className="rounded-boton border border-teal-texto/40 bg-teal-texto/5 p-4 text-[14px] text-cuerpo">
        Recibido. Te responderemos en un plazo máximo de 3 días. Si procede, la ficha mostrará la rectificación y su historial.
      </p>
    );
  }

  return (
    <form action={enviar} className="space-y-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="captcha_token" value={token} />
      {/* Trampa para bots: invisible para personas. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Web <input name="web" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="grid gap-3 min-[640px]:grid-cols-2">
        <div>
          <label className={etiqueta} htmlFor="r_nombre">
            Nombre
          </label>
          <input id="r_nombre" name="nombre" required maxLength={200} className={control} />
        </div>
        <div>
          <label className={etiqueta} htmlFor="r_email">
            Correo
          </label>
          <input id="r_email" name="email" type="email" required maxLength={200} className={control} />
        </div>
      </div>
      <div>
        <label className={etiqueta} htmlFor="r_rol">
          Escribo como
        </label>
        <select id="r_rol" name="rol" required defaultValue="afectado" className={control}>
          <option value="afectado">Persona o entidad afectada</option>
          <option value="representante">Representante de la persona o entidad afectada</option>
          <option value="otro">Otra persona que ha detectado un error</option>
        </select>
      </div>
      <div>
        <label className={etiqueta} htmlFor="r_texto">
          Qué hay que corregir y por qué
        </label>
        <textarea id="r_texto" name="texto" required minLength={20} rows={5} className={control} />
      </div>
      <div>
        <label className={etiqueta} htmlFor="r_captcha">
          {pregunta}
        </label>
        <input id="r_captcha" name="captcha_respuesta" inputMode="numeric" required className={`${control} max-w-[140px]`} />
      </div>
      <label className="flex items-start gap-2 text-[13px] text-cuerpo">
        <input type="checkbox" name="acepta" required className="mt-1" />
        Acepto que Razón Común trate estos datos solo para estudiar y responder esta solicitud.
      </label>
      {estado && 'error' in estado && <p className="text-[13.5px] text-magenta">{estado.error}</p>}
      <button
        type="submit"
        disabled={pendiente}
        className="rounded-boton bg-accion px-5 py-2.5 text-[14px] font-bold text-white disabled:opacity-50"
      >
        {pendiente ? 'Enviando…' : 'Enviar solicitud'}
      </button>
    </form>
  );
}
