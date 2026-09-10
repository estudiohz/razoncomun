/**
 * Extrae el ID de vídeo de cualquier forma habitual de URL de YouTube
 * (watch?v=, youtu.be/, /shorts/, /embed/). Devuelve null si no reconoce el
 * formato — mejor no pintar nada que pintar un embed roto.
 *
 * Vive en su propio fichero, sin `server-only`, a propósito: es lógica pura
 * sin nada de Supabase, así que `video-destacado.ts` (que sí lo lleva) puede
 * reexportarla, y esto se puede testear con vitest en un entorno normal.
 * `server-only` solo se resuelve dentro del build de Next — vitest no lo
 * conoce y falla al cargar el módulo (mismo patrón ya usado en
 * `lib/tienda/precios.ts` / `pedido.ts` frente a `lib/tienda/cumplir.ts`).
 */
export function idYoutubeDesdeUrl(url: string): string | null {
  const limpia = url.trim();
  if (!limpia) return null;

  const patron =
    /(?:youtube\.com\/watch\?v=|youtube\.com\/shorts\/|youtube\.com\/embed\/|youtu\.be\/)([A-Za-z0-9_-]{11})/;
  const m = limpia.match(patron);
  return m ? m[1] : null;
}
