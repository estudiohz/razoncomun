import { anonKeySupabase, urlSupabase } from '@/lib/supabase/env';

/**
 * ¿Está Google OAuth activo? Se le pregunta a GoTrue EN RUNTIME
 * (`/auth/v1/settings`, cacheado 5 min) en vez de leer una variable
 * NEXT_PUBLIC_* horneada en el build.
 *
 * Historia del cambio (02/08/2026): la bandera de build llevaba días en
 * `false` en Dokploy con GoTrue ya configurado y verificado — el botón seguía
 * en "pronto" por una variable, y encenderla exigía tocar el entorno + rebuild
 * (y la escritura de env por API está bloqueada a propósito). GoTrue es la
 * única fuente de verdad de qué proveedores funcionan: preguntarle elimina la
 * bandera, el rebuild y la posibilidad de que ambos discrepen — enseñar un
 * botón de Google que GoTrue va a rechazar, o esconder uno que funciona.
 *
 * En error de red se devuelve false: mejor no enseñar el botón un rato que
 * enseñar uno roto.
 */
export async function googleOAuthActivo(): Promise<boolean> {
  try {
    const res = await fetch(`${urlSupabase()}/auth/v1/settings`, {
      headers: { apikey: anonKeySupabase() },
      next: { revalidate: 300 },
    });
    if (!res.ok) return false;
    const settings = (await res.json()) as { external?: { google?: boolean } };
    return settings.external?.google === true;
  } catch {
    return false;
  }
}
