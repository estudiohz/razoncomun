import 'server-only';
import { cookies } from 'next/headers';
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { COOKIE_AVISO, codificarAviso, type TipoAviso } from './comun';

/**
 * Deja un aviso para la próxima pintada de la página (cookie flash). Se puede
 * llamar desde una server action antes de `redirect` o `revalidatePath`. Fuera
 * de una action (en render) no se pueden escribir cookies: se ignora.
 */
export async function avisar(texto: string, tipo: TipoAviso = 'exito') {
  try {
    const almacen = await cookies();
    almacen.set(COOKIE_AVISO, codificarAviso({ id: `${Date.now()}-${Math.random()}`, texto, tipo }), {
      path: '/',
      maxAge: 60,
      sameSite: 'lax',
      httpOnly: false, // lo borra el cliente al mostrarlo
    });
  } catch {
    /* llamada fuera de una server action */
  }
}

/** Saca el mensaje de error de lo que devuelven las actions de la web. */
function errorDelResultado(r: unknown): string | null {
  if (!r || typeof r !== 'object') return null;
  const o = r as { ok?: unknown; error?: unknown; mensaje?: unknown };
  if (typeof o.error === 'string' && o.error) return o.error;
  if (o.ok === false) return typeof o.mensaje === 'string' && o.mensaje ? o.mensaje : 'No se ha podido completar.';
  return null;
}

/**
 * Envuelve el cuerpo de una server action y avisa del resultado:
 * - devuelve `{ error }` u `{ ok: false }` → aviso de error con ese texto;
 * - lanza una excepción → aviso de error y se relanza (la UI sigue igual);
 * - termina bien (o con `redirect`) → aviso de éxito con `exito`.
 *
 * `exito` puede ser una función del resultado, para textos que dependen de él
 * («Artículo publicado» frente a «Borrador guardado»).
 */
export async function conAviso<T>(
  exito: string | ((resultado: T) => string | null),
  cuerpo: () => Promise<T>,
): Promise<T> {
  let resultado: T;
  try {
    resultado = await cuerpo();
  } catch (e) {
    if (isRedirectError(e)) {
      const texto = typeof exito === 'string' ? exito : null;
      if (texto) await avisar(texto);
    } else {
      const msg = e instanceof Error && e.message && !/^NEXT_/.test(e.message) ? e.message : 'Ha ocurrido un error.';
      await avisar(`No se ha podido completar: ${msg}`, 'error');
    }
    throw e;
  }
  const error = errorDelResultado(resultado);
  if (error) {
    await avisar(error, 'error');
  } else {
    const texto = typeof exito === 'string' ? exito : exito(resultado);
    if (texto) await avisar(texto);
  }
  return resultado;
}
