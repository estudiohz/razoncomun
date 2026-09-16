'use client';

import { useActionState } from 'react';
import { guardarEnlaceDiscord, type ResultadoPortada } from './actions';

const etiqueta = 'mb-2 block text-[13px] font-bold uppercase tracking-[.08em] text-gris';
const areaTexto =
  'w-full rounded-boton border border-linea bg-white px-4 py-2.5 text-[14px] outline-none focus:border-titular';

/**
 * El enlace de invitación a Discord del botón de la home (16/09/2026). Ver
 * `lib/home/discord.ts` para el porqué de sacarlo del código: los invites
 * de Discord caducan a los 7 días o a N usos salvo que se creen "Nunca" /
 * "Sin límite" — y cuando caducan, cambiarlos ya no debe pedir un deploy.
 */
export function FormularioEnlaceDiscord({ urlInicial }: { urlInicial: string }) {
  const [estado, accion, guardando] = useActionState<ResultadoPortada | null, FormData>(
    guardarEnlaceDiscord,
    null,
  );

  return (
    <form action={accion} className="space-y-2">
      <label className={etiqueta} htmlFor="discord_url">
        Enlace de invitación a Discord
      </label>
      <input
        id="discord_url"
        name="discord_url"
        type="url"
        className={areaTexto}
        placeholder="https://discord.gg/..."
        defaultValue={urlInicial}
      />
      <p className="text-[13px] text-gris">
        Al crear el enlace en Discord (botón derecho en un canal → Invitar), pon "Caduca después:
        Nunca" y "Número máximo de usos: Sin límite" — si no, este campo habrá que volver a
        rellenarlo cuando caduque.
      </p>
      <button
        type="submit"
        disabled={guardando}
        className="rounded-boton bg-accion px-5 py-2.5 text-[14px] font-bold text-white disabled:opacity-60"
      >
        {guardando ? 'Guardando…' : 'Guardar'}
      </button>
      {estado?.error ? <p className="text-[13px] text-[#C3369E]">{estado.error}</p> : null}
      {estado?.ok ? <p className="text-[13px] text-accion">Guardado.</p> : null}
    </form>
  );
}
