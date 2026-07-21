import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Sirve el simulador HTML adjunto a una entrada del cerebro (0027) para
 * incrustarlo en un <iframe sandbox> desde el chat (pieza A). Reglas:
 *
 * - Solo entradas `visibility='public'` con `embed_html` no nulo. Interno o
 *   inexistente => 404 (mismo criterio que el chat público: I3).
 * - Se lee con `service_role` porque `brain_entries` está cerrada por RLS a
 *   anon/authenticated; el filtro de visibilidad lo aplica ESTE handler.
 * - CSP estrictísima de cabecera + el `sandbox="allow-scripts"` del iframe
 *   (sin allow-same-origin) hacen que el JS del simulador corra en un origen
 *   opaco: no puede tocar la sesión, las cookies ni el DOM de la app. Así es
 *   seguro servir HTML de autoría del admin aunque una cuenta se comprometa
 *   (D-CP-2).
 */
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new Response('No encontrado.', { status: 404 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('brain_entries')
    .select('embed_html, visibility')
    .eq('id', id)
    .maybeSingle();

  if (error || !data || data.visibility !== 'public' || !data.embed_html) {
    return new Response('No encontrado.', { status: 404 });
  }

  return new Response(data.embed_html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy':
        "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
