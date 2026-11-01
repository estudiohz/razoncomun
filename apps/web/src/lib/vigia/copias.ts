import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Copias de respaldo de un caso (0074): se descarga el origen o la prueba
 * oficial, se calcula su sha256 y se guarda en el bucket PRIVADO
 * `vigia-pruebas`. Si mañana la página cambia o desaparece, queda lo que decía
 * el día que se comprobó (M2, M11).
 *
 * Solo servidor y con el cliente de servicio: el bucket no tiene políticas
 * para usuarios; los auditores descargan con una URL firmada.
 */

export const BUCKET_COPIAS = 'vigia-pruebas';
const MAX_BYTES = 15 * 1024 * 1024; // páginas y registros; los vídeos van por otra vía

export type TipoCopia = 'origen' | 'prueba';
export type MetodoCopia = 'html' | 'json' | 'pdf' | 'video' | 'imagen' | 'otro';

export function sha256(datos: Uint8Array): string {
  return createHash('sha256').update(datos).digest('hex');
}

/** Qué clase de copia es, por su tipo MIME. */
export function metodoDeMime(mime: string | null): MetodoCopia {
  const m = (mime ?? '').toLowerCase();
  if (m.includes('json')) return 'json';
  if (m.includes('html') || m.startsWith('text/')) return 'html';
  if (m.includes('pdf')) return 'pdf';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('image/')) return 'imagen';
  return 'otro';
}

const EXTENSION: Record<MetodoCopia, string> = { html: 'html', json: 'json', pdf: 'pdf', video: 'mp4', imagen: 'img', otro: 'bin' };

/** Instagram/TikTok sin sesión solo devuelven la pantalla de login: no sirve como copia. */
export function esRedSocial(url: string): boolean {
  return /^https?:\/\/(www\.)?(instagram\.com|tiktok\.com)\//i.test(url);
}

export interface CopiaGuardada {
  id: string;
  sha256: string;
  storage_path: string;
}

/** Guarda unos bytes ya descargados (también para el vídeo que sube n8n). */
export async function guardarBytes(
  admin: SupabaseClient,
  d: {
    alertId: string;
    evidenceId?: string | null;
    tipo: TipoCopia;
    url: string;
    datos: Uint8Array;
    mime: string | null;
    metodo?: MetodoCopia;
    notas?: string | null;
    createdBy?: string | null;
  },
): Promise<CopiaGuardada> {
  const huella = sha256(d.datos);
  const metodo = d.metodo ?? metodoDeMime(d.mime);
  const ruta = `${d.alertId}/${d.tipo}/${huella}.${EXTENSION[metodo]}`;

  const { error: errSubida } = await admin.storage
    .from(BUCKET_COPIAS)
    .upload(ruta, d.datos, { contentType: d.mime ?? 'application/octet-stream', upsert: false });
  // Mismo contenido ya guardado = misma huella: no es un error, es la misma copia.
  if (errSubida && !/exist|duplicate/i.test(errSubida.message)) throw new Error(`No se pudo guardar la copia: ${errSubida.message}`);

  const { data, error } = await admin
    .from('watchdog_copias')
    .upsert(
      {
        alert_id: d.alertId,
        evidence_id: d.evidenceId ?? null,
        tipo: d.tipo,
        metodo,
        url: d.url,
        storage_path: ruta,
        sha256: huella,
        mime: d.mime,
        bytes: d.datos.byteLength,
        notas: d.notas ?? null,
        created_by: d.createdBy ?? null,
      },
      { onConflict: 'alert_id,sha256' },
    )
    .select('id, sha256, storage_path')
    .single();
  if (error || !data) throw new Error(`No se pudo registrar la copia: ${error?.message}`);

  if (d.evidenceId) {
    await admin
      .from('watchdog_evidence')
      .update({ snapshot_path: ruta, snapshot_sha256: huella, snapshot_at: new Date().toISOString() })
      .eq('id', d.evidenceId);
  }
  return data;
}

/** Descarga una URL y la guarda como copia. Tiempo y tamaño acotados. */
export async function guardarCopia(
  admin: SupabaseClient,
  d: { alertId: string; evidenceId?: string | null; tipo: TipoCopia; url: string; createdBy?: string | null; timeoutMs?: number },
): Promise<CopiaGuardada> {
  if (!/^https?:\/\//i.test(d.url)) throw new Error('URL no válida');
  const r = await fetch(d.url, {
    signal: AbortSignal.timeout(d.timeoutMs ?? 20000),
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; RazonComun-Auditoria/1.0; +https://razoncomun.com)',
      accept: 'text/html,application/json,application/pdf;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`La fuente respondió ${r.status}`);
  const largo = Number(r.headers.get('content-length') ?? 0);
  if (largo > MAX_BYTES) throw new Error('El documento es demasiado grande para copiarlo');
  const datos = new Uint8Array(await r.arrayBuffer());
  if (datos.byteLength > MAX_BYTES) throw new Error('El documento es demasiado grande para copiarlo');

  return guardarBytes(admin, {
    ...d,
    datos,
    mime: r.headers.get('content-type')?.split(';')[0].trim() ?? null,
    notas: r.url !== d.url ? `Redirigido a ${r.url}` : null,
  });
}
