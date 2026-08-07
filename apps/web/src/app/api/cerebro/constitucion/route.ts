import { createAdminClient } from '@/lib/supabase/admin';
import { generarConstitucion } from '@/lib/cerebro/constitucion';

/**
 * Genera la "constitución" en Markdown del cerebro (0046, petición de
 * Sergio): la wiki de conocimiento (`brain_entries`, TODAS las entradas,
 * también las internas) organizada en un índice + un archivo por categoría.
 * Devuelve el CONTENIDO, no lo escribe en git — eso lo hace el workflow n8n
 * "cerebro-constitucion" (Schedule Trigger diario → este endpoint → nodo
 * GitHub "Create/Update File" por cada archivo devuelto) contra
 * `razoncomun-docs`, el repo PRIVADO de documentación — nunca contra
 * `razoncomun` (código, público).
 *
 * Protegido por secreto compartido (no hay sesión de usuario: lo llama un
 * workflow, no un navegador) — mismo patrón que un webhook interno.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const secreto = process.env.CEREBRO_EXPORT_SECRET;
  if (!secreto) {
    return Response.json({ error: 'CEREBRO_EXPORT_SECRET no configurado en este entorno.' }, { status: 503 });
  }
  if (request.headers.get('x-cerebro-secret') !== secreto) {
    return Response.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const admin = createAdminClient();
  const resultado = await generarConstitucion(admin);
  return Response.json(resultado);
}
