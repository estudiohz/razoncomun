'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Actualiza los campos NO sensibles del perfil propio. `level` no está en la
 * lista de columnas permitidas a propósito: está protegido por trigger en BD
 * (profiles_protect_level_trg) y esta acción ni lo intenta tocar.
 */
export async function actualizarPerfil(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/entrar');

  const display_name = (formData.get('display_name') as string)?.trim() || null;
  const origin_province_raw = formData.get('origin_province_id') as string;
  const origin_province_id = origin_province_raw ? Number(origin_province_raw) : null;
  const newsletter_opt_in = formData.get('newsletter_opt_in') === 'on';

  const { data: perfilActual } = await supabase
    .from('profiles')
    .select('newsletter_opt_in, newsletter_opt_in_at')
    .eq('id', user.id)
    .single();

  const cambioNewsletter = perfilActual?.newsletter_opt_in !== newsletter_opt_in;

  await supabase
    .from('profiles')
    .update({
      display_name,
      origin_province_id,
      newsletter_opt_in,
      ...(cambioNewsletter
        ? { newsletter_opt_in_at: newsletter_opt_in ? new Date().toISOString() : null }
        : {}),
    })
    .eq('id', user.id);

  revalidatePath('/perfil');
}

export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}
