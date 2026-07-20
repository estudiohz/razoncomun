'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type EstadoActualizarPerfil = {
  ok: boolean | null; // null = todavía no se ha enviado nada
  mensaje: string;
  // Eco de lo que quedó persistido de verdad en BD tras un guardado con
  // éxito. El formulario cliente (PerfilDatosForm.tsx) resincroniza su
  // estado local con ESTOS valores (no con las props iniciales del Server
  // Component) al recibir un `ok:true` — evita que el <select> muestre un
  // valor viejo si, por lo que sea, el re-render que sigue a
  // `revalidatePath` no llega a refrescar las props del cliente a tiempo
  // (BUG reportado por Sergio: el selector volvía a Albacete tras guardar
  // Navarra, aunque en BD y tras recargar la página sí quedaba Navarra).
  valores?: {
    display_name: string;
    origin_province_id: number | null;
    newsletter_opt_in: boolean;
    newsletter_opt_in_at: string | null;
  };
};

/**
 * Actualiza los campos NO sensibles del perfil propio. `level` no está en la
 * lista de columnas permitidas a propósito: está protegido por trigger en BD
 * (profiles_protect_level_trg) y esta acción ni lo intenta tocar.
 *
 * Firma (prevState, formData) para poder usarla con useActionState desde
 * PerfilDatosForm.tsx — así el formulario recibe SIEMPRE un resultado
 * explícito (antes el `.update()` se ignoraba en silencio: BUG reportado
 * por Sergio, el guardado parecía "no hacer nada").
 */
export async function actualizarPerfil(
  _prevState: EstadoActualizarPerfil,
  formData: FormData,
): Promise<EstadoActualizarPerfil> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/entrar');

  const display_name = (formData.get('display_name') as string)?.trim() || null;
  const origin_province_raw = formData.get('origin_province_id') as string;
  const origin_province_id = origin_province_raw ? Number(origin_province_raw) : null;
  const newsletter_opt_in = formData.get('newsletter_opt_in') === 'on';

  const { data: perfilActual, error: errorLectura } = await supabase
    .from('profiles')
    .select('newsletter_opt_in, newsletter_opt_in_at')
    .eq('id', user.id)
    .single();

  if (errorLectura) {
    return { ok: false, mensaje: 'No hemos podido leer tu perfil. Inténtalo de nuevo.' };
  }

  const cambioNewsletter = perfilActual?.newsletter_opt_in !== newsletter_opt_in;
  const newsletter_opt_in_at = cambioNewsletter
    ? newsletter_opt_in
      ? new Date().toISOString()
      : null
    : (perfilActual?.newsletter_opt_in_at ?? null);

  const { data: filaActualizada, error: errorUpdate } = await supabase
    .from('profiles')
    .update({
      display_name,
      origin_province_id,
      newsletter_opt_in,
      ...(cambioNewsletter ? { newsletter_opt_in_at } : {}),
    })
    .eq('id', user.id)
    .select('display_name, origin_province_id, newsletter_opt_in, newsletter_opt_in_at')
    .single();

  if (errorUpdate || !filaActualizada) {
    return {
      ok: false,
      mensaje: 'No se ha podido guardar. Vuelve a intentarlo en unos segundos.',
    };
  }

  revalidatePath('/perfil');
  return { ok: true, mensaje: 'Guardado.', valores: filaActualizada };
}

export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}
