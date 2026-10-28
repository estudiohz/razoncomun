import type { SupabaseClient } from '@supabase/supabase-js';
import { BUCKET_PORTADAS } from '@/lib/blog/guard';
import { slugificar } from '@/lib/blog/html';
import { aUrlPublica } from '@/lib/supabase/env';

/**
 * Informe del test de estrés de una propuesta (`proposals.report_url`).
 *
 * Hasta ahora el campo solo se leía y nadie lo rellenaba desde el admin: quedó
 * un enlace a un PDF que nunca existió (404 en producción). Por eso aquí un
 * enlace externo se COMPRUEBA al guardarlo: si no responde, no se acepta.
 */

export const MAX_INFORME_BYTES = 20 * 1024 * 1024;

/** Sube el PDF a Storage y devuelve su URL pública. `admin` = cliente con service role. */
export async function subirInformePdf(
  admin: SupabaseClient,
  propuestaId: string,
  archivo: File,
  carpeta: 'informes' | 'simulaciones' = 'informes',
): Promise<string> {
  if (archivo.type !== 'application/pdf' && !archivo.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('El informe debe ser un PDF.');
  }
  if (archivo.size > MAX_INFORME_BYTES) throw new Error('El PDF supera los 20 MB.');

  const base = slugificar(archivo.name.replace(/\.[^.]+$/, '')) || 'informe';
  const ruta = `${carpeta}/${propuestaId}-${Date.now()}-${base}.pdf`;
  const { error } = await admin.storage
    .from(BUCKET_PORTADAS)
    .upload(ruta, archivo, { cacheControl: '31536000', upsert: false, contentType: 'application/pdf' });
  if (error) throw new Error(`No se ha podido subir el PDF: ${error.message}`);

  return aUrlPublica(admin.storage.from(BUCKET_PORTADAS).getPublicUrl(ruta).data.publicUrl);
}

/** Normaliza un enlace externo y comprueba que responde. Lanza con un mensaje entendible si no. */
export async function validarEnlaceInforme(bruto: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(bruto.trim());
  } catch {
    throw new Error('El enlace no es una URL válida.');
  }
  if (url.protocol !== 'https:') throw new Error('El enlace debe empezar por https://.');

  const probar = (init: RequestInit) =>
    fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(8000), ...init });
  try {
    let r = await probar({ method: 'HEAD' });
    // Algunos servidores no aceptan HEAD: se reintenta pidiendo solo el primer byte.
    if (r.status === 405 || r.status === 403 || r.status === 501) {
      r = await probar({ method: 'GET', headers: { Range: 'bytes=0-0' } });
    }
    if (!r.ok) throw new Error(`El enlace responde ${r.status}: el informe no existe en esa dirección.`);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('El enlace responde')) throw e;
    throw new Error('No se ha podido comprobar el enlace (sin respuesta). Revisa la dirección.');
  }
  return url.toString();
}
