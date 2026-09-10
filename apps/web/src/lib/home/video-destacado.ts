import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { idYoutubeDesdeUrl } from './youtube';

/**
 * "Vídeo destacado" de la portada (10/09/2026, encargo de Sergio): sustituye
 * el tercer hueco de "Lo último del blog" (ahora "Actualidad") por una
 * carátula con play que abre un vídeo de YouTube.
 *
 * Vive en `settings` (0019, ya existente) en vez de una tabla propia: es un
 * dato singular —solo hay UN vídeo destacado a la vez—, exactamente el caso
 * de uso que esa tabla ya resuelve para `min_membership_days` y el código de
 * seguimiento. Dos claves:
 *
 *   home_video_url        -> el enlace de YouTube que pegó el admin
 *   home_video_caratula   -> URL de la imagen subida (bucket `articulos`,
 *                             misma carpeta que las portadas del blog)
 *
 * Lectura pública (settings_select_public, 0019): la portada la ve cualquier
 * visitante sin sesión.
 *
 * `idYoutubeDesdeUrl` vive aparte, en `./youtube.ts`, sin `server-only`: ver
 * ese fichero para el porqué (permite testearla con vitest).
 */
export { idYoutubeDesdeUrl } from './youtube';

export interface VideoDestacado {
  /** El ID de 11 caracteres de YouTube, para construir el embed. */
  youtubeId: string;
  /** URL completa que se enlaza si alguien quiere abrirlo en YouTube. */
  urlOriginal: string;
  caratula: string | null;
}

/** Lee el vídeo destacado configurado, o null si no hay ninguno válido. */
export async function leerVideoDestacado(): Promise<VideoDestacado | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', ['home_video_url', 'home_video_caratula']);

  const porClave = new Map((data ?? []).map((f) => [f.key, f.value]));
  const urlCruda = porClave.get('home_video_url');
  const url = typeof urlCruda === 'string' ? urlCruda : '';
  const youtubeId = idYoutubeDesdeUrl(url);
  if (!youtubeId) return null;

  const caratulaCruda = porClave.get('home_video_caratula');
  const caratula = typeof caratulaCruda === 'string' && caratulaCruda ? caratulaCruda : null;

  return { youtubeId, urlOriginal: url, caratula };
}
