import 'server-only';
import { createClient } from '@/lib/supabase/server';

/**
 * Modo catálogo de la tienda (19/11/2026): los productos se ven, pero no se
 * pueden comprar. Se activa desde /admin/tienda mientras Printful no tenga
 * método de facturación (sin él, cada pedido cobrado se queda en "failed" y
 * el cliente paga algo que no se fabrica).
 *
 * Clave `tienda_modo_catalogo` en `settings` (lectura pública por RLS 0019,
 * escritura solo admin). Ausente o no-true = tienda vendiendo con normalidad.
 */
export const CLAVE_MODO_CATALOGO = 'tienda_modo_catalogo';

export async function tiendaEnModoCatalogo(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', CLAVE_MODO_CATALOGO)
    .maybeSingle();
  return data?.value === true;
}
