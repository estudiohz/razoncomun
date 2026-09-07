import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

/**
 * Lee el código de seguimiento que el admin haya guardado en Ajustes.
 *
 * Lo llama el layout raíz, o sea que corre en CADA página. Va envuelto en
 * `cache()` de React para que sea una sola consulta por petición aunque el
 * layout se evalúe varias veces, y la acción del admin hace
 * `revalidatePath('/', 'layout')` al guardar para que el cambio se vea sin
 * esperar.
 *
 * Se lee con el cliente normal, no con el de servicio: `settings` tiene
 * lectura pública (`settings_select_public`, 0019) precisamente porque este
 * dato tiene que llegar al navegador de cualquier visitante. Escribirlo, en
 * cambio, solo puede un admin.
 *
 * Si la consulta falla se devuelve vacío: quedarse sin analítica es molesto,
 * tumbar el layout de todo el sitio es otra cosa.
 */
export const codigoSeguimiento = cache(async (): Promise<{ head: string; body: string }> => {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['tracking_head', 'tracking_body']);

    const porClave = new Map((data ?? []).map((f) => [f.key, f.value]));
    return {
      head: typeof porClave.get('tracking_head') === 'string' ? String(porClave.get('tracking_head')) : '',
      body: typeof porClave.get('tracking_body') === 'string' ? String(porClave.get('tracking_body')) : '',
    };
  } catch {
    return { head: '', body: '' };
  }
});
