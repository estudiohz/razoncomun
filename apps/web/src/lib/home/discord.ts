import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { site } from '@/lib/site';

/**
 * Enlace de invitación a Discord de la home (16/09/2026, encargo de Sergio
 * tras el segundo enlace caducado en una semana: "mejor ponemos un campo
 * igual que hicimos con los vídeos de la portada").
 *
 * Mismo modelo que `home_video_url` (`lib/home/video-destacado.ts`): una
 * clave en `settings` en vez de una tabla propia — es un dato singular, solo
 * hay UN enlace de invitación activo a la vez.
 *
 * `site.discord` (lib/site.ts) queda como valor de reserva por si la fila
 * aún no existe o alguien la vacía sin querer — nunca deja el botón sin
 * destino.
 */
export async function leerEnlaceDiscord(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'discord_invite_url')
    .maybeSingle();

  const url = typeof data?.value === 'string' ? data.value.trim() : '';
  return url || site.discord;
}
