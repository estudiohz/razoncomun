'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Pasarela de consentimiento obligatoria (Art. 9 RGPD) para cualquier
 * usuario autenticado que aún no tenga `privacy_consent_at`. Cubre el hueco
 * de OAuth (Google/Facebook no pasan por el checkbox de /registro) y
 * cualquier otro camino de alta que no sea el formulario propio.
 */
export async function aceptarConsentimiento(formData: FormData) {
  const next = (formData.get('next') as string) || '/perfil';
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/entrar');

  await supabase
    .from('profiles')
    .update({ privacy_consent_at: new Date().toISOString() })
    .eq('id', user.id);

  redirect(next);
}
