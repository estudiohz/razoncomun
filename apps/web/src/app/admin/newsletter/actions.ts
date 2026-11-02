'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin, requireAdminOrEditor } from '@/lib/admin/guard';
import { createAdminClient } from '@/lib/supabase/admin';
import { enviarPrueba, type TipoCampana } from '@/lib/newsletter/campanas';

/** Manda a quien lo pide los dos correos con su contenido actual, marcados [PRUEBA]. */
export async function enviarmePrueba(): Promise<{ ok: boolean; mensaje: string }> {
  const { user } = await requireAdminOrEditor('/admin/newsletter');
  if (!user.email) return { ok: false, mensaje: 'Tu cuenta no tiene correo.' };
  const admin = createAdminClient();
  const tipos: TipoCampana[] = ['encuesta_inicio', 'encuesta_recordatorio'];
  const r = await Promise.all(tipos.map((t) => enviarPrueba(admin, t, user.email!)));
  return r.every((x) => x.enviado)
    ? { ok: true, mensaje: `Enviados 2 correos de prueba a ${user.email}.` }
    : { ok: false, mensaje: `No se pudo enviar: ${r.find((x) => !x.enviado)?.motivo ?? 'error'}` };
}

/** Cancela una campaña que aún está enviando: lo pendiente ya no sale. */
export async function cancelarCampana(id: string): Promise<void> {
  await requireAdmin('/admin/newsletter');
  const admin = createAdminClient();
  await admin.from('newsletter_campaigns').update({ estado: 'cancelada' }).eq('id', id).eq('estado', 'enviando');
  await admin.from('newsletter_envios').update({ estado: 'omitido', error: 'campaña cancelada' }).eq('campaign_id', id).eq('estado', 'pendiente');
  revalidatePath('/admin/newsletter');
  revalidatePath(`/admin/newsletter/${id}`);
}
