/**
 * Avisos de resultado ("Cambio guardado", "Rol asignado"…). NORMA de la web:
 * toda acción que guarda, edita, publica o borra avisa de que ha ido bien, y
 * también de que ha fallado (feedback de Óscar). Ver la norma en el README del repo.
 *
 * Viajan de dos formas, las dos pintadas por `<Avisos />`:
 * - Desde el servidor: cookie flash `rc_aviso` (lib/avisos/servidor.ts), que
 *   sobrevive a `redirect` y a `revalidatePath`.
 * - Desde el cliente: evento de ventana (lib/avisos/cliente.ts).
 */
export type TipoAviso = 'exito' | 'error';

export interface Aviso {
  id: string;
  texto: string;
  tipo: TipoAviso;
}

export const COOKIE_AVISO = 'rc_aviso';
export const EVENTO_AVISO = 'rc-aviso';

export function codificarAviso(aviso: Aviso): string {
  return encodeURIComponent(JSON.stringify(aviso));
}

export function decodificarAviso(valor: string | undefined | null): Aviso | null {
  if (!valor) return null;
  try {
    const a = JSON.parse(decodeURIComponent(valor)) as Partial<Aviso>;
    if (typeof a.texto !== 'string' || !a.texto) return null;
    return { id: String(a.id ?? a.texto), texto: a.texto, tipo: a.tipo === 'error' ? 'error' : 'exito' };
  } catch {
    return null;
  }
}
