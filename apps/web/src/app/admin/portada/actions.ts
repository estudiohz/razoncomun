'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/guard';
import { registrarAuditoria } from '@/lib/admin/audit';
import { aUrlPublica } from '@/lib/supabase/env';
import { idYoutubeDesdeUrl } from '@/lib/home/youtube';

/**
 * Vídeo destacado de la portada (10/09/2026). Ver `lib/home/video-destacado.ts`
 * para el porqué del modelo (dos claves en `settings`).
 *
 * Solo admin, no editor: es contenido de la home pública, mismo nivel de
 * exigencia que el resto de `/admin/ajustes`. Sin "motivo" obligatorio —a
 * diferencia de `min_membership_days` o el código de seguimiento, esto no es
 * ni una regla de votación ni código que se ejecuta en el navegador de cada
 * visitante— pero sí queda en `audit_log`, como cualquier escritura en
 * `settings`.
 */

async function upsertSetting(
  supabase: Awaited<ReturnType<typeof requireAdmin>>['supabase'],
  userId: string,
  key: string,
  value: string,
) {
  const { error } = await supabase.from('settings').upsert({
    key,
    value,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`No se pudo guardar «${key}»: ${error.message}`);
}

export interface ResultadoPortada {
  ok: boolean;
  error?: string;
}

/** Guarda la URL de YouTube del vídeo destacado. */
export async function guardarVideoDestacado(
  _previo: ResultadoPortada | null,
  formData: FormData,
): Promise<ResultadoPortada> {
  const { user, supabase } = await requireAdmin('/admin/portada');
  const url = String(formData.get('url') ?? '').trim();

  // Vacío = quitar el vídeo destacado (vuelve a verse "Lo último del blog"
  // con tres huecos, ver FeedObservatorio.tsx). No es un error.
  if (url && !idYoutubeDesdeUrl(url)) {
    return { ok: false, error: 'Esa URL no parece de YouTube. Copia el enlace tal cual del navegador o de "Compartir".' };
  }

  await upsertSetting(supabase, user.id, 'home_video_url', url);
  await registrarAuditoria(supabase, {
    actorId: user.id,
    action: 'setting_changed',
    entity: 'settings',
    entityId: null,
    meta: { key: 'home_video_url', to: url || null },
  });

  revalidatePath('/admin/portada');
  revalidatePath('/');
  return { ok: true };
}

export interface ResultadoCaratula {
  url?: string;
  error?: string;
}

/** Sube la carátula del vídeo destacado. Mismo bucket que las portadas del
 *  blog (`articulos`): no hay razón para un bucket propio para una sola
 *  imagen, y así hereda sus mismas políticas de Storage ya probadas. */
export async function subirCaratulaVideo(
  _previo: ResultadoCaratula | null,
  formData: FormData,
): Promise<ResultadoCaratula> {
  const { user, supabase } = await requireAdmin('/admin/portada');

  const archivo = formData.get('archivo');
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: 'Selecciona una imagen.' };
  }
  if (!/^image\/(jpeg|png|webp|avif)$/.test(archivo.type)) {
    return { error: 'Formato no admitido. Usa JPG, PNG, WebP o AVIF.' };
  }
  if (archivo.size > 5 * 1024 * 1024) {
    return { error: 'La imagen supera los 5 MB.' };
  }

  const ext = archivo.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const ruta = `portadas/video-destacado-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from('articulos')
    .upload(ruta, archivo, { cacheControl: '31536000', upsert: false });
  if (error) return { error: `No se ha podido subir: ${error.message}` };

  const { data } = supabase.storage.from('articulos').getPublicUrl(ruta);
  const urlPublica = aUrlPublica(data.publicUrl);

  await upsertSetting(supabase, user.id, 'home_video_caratula', urlPublica);
  await registrarAuditoria(supabase, {
    actorId: user.id,
    action: 'setting_changed',
    entity: 'settings',
    entityId: null,
    meta: { key: 'home_video_caratula', to: urlPublica },
  });

  revalidatePath('/admin/portada');
  revalidatePath('/');
  return { url: urlPublica };
}
