'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/guard';
import {
  ClaveMaestraPagosAusenteError,
  guardarCredencial,
  type Pasarela,
} from '@/lib/pagos/credenciales';
import { createAdminClient } from '@/lib/supabase/admin';

export interface ResultadoPagos {
  ok: boolean;
  error?: string;
  aviso?: string;
}

function texto(fd: FormData, campo: string): string {
  return String(fd.get(campo) ?? '').trim();
}

/**
 * Guarda la credencial de una pasarela.
 *
 * `requireAdmin` y no `requireEditor`: esto mueve dinero de verdad, y la tabla
 * además está cerrada a service_role (0053), así que la única puerta es esta
 * acción. El secreto entra, se cifra en la base y NO vuelve a salir: la
 * pantalla solo verá los 4 últimos caracteres.
 */
export async function guardarCredencialPago(
  _previo: ResultadoPagos | null,
  fd: FormData,
): Promise<ResultadoPagos> {
  const { user } = await requireAdmin('/admin/tienda/pagos');

  const provider = texto(fd, 'provider') as Pasarela;
  if (provider !== 'stripe' && provider !== 'paypal') {
    return { ok: false, error: 'Pasarela no soportada.' };
  }

  const secret = texto(fd, 'secret');
  if (!secret) return { ok: false, error: 'Pega la clave secreta.' };

  try {
    await guardarCredencial({
      provider,
      secret,
      publicKey: texto(fd, 'public_key'),
      webhook: texto(fd, 'webhook'),
      mode: texto(fd, 'mode') === 'live' ? 'live' : 'test',
      actorId: user.id,
    });
  } catch (err) {
    if (err instanceof ClaveMaestraPagosAusenteError) return { ok: false, error: err.message };
    return { ok: false, error: err instanceof Error ? err.message : 'No se ha podido guardar.' };
  }

  revalidatePath('/admin/tienda/pagos');
  return {
    ok: true,
    aviso:
      provider === 'paypal'
        ? 'Guardada. Todavía no hay ningún cobro por PayPal: se usará cuando exista el checkout.'
        : undefined,
  };
}

/** Enciende o apaga métodos de pago. No toca el panel de Stripe: ver 0053. */
export async function guardarMetodosPago(
  _previo: ResultadoPagos | null,
  fd: FormData,
): Promise<ResultadoPagos> {
  await requireAdmin('/admin/tienda/pagos');

  const codigos = fd.getAll('codigos').map(String);
  const activos = new Set(fd.getAll('enabled').map(String));
  if (codigos.length === 0) return { ok: false, error: 'No ha llegado ningún método.' };

  const admin = createAdminClient();
  for (const code of codigos) {
    const { error } = await admin
      .from('payment_methods')
      .update({ enabled: activos.has(code) })
      .eq('code', code);
    if (error) return { ok: false, error: `No se ha podido guardar ${code}: ${error.message}` };
  }

  revalidatePath('/admin/tienda/pagos');
  return { ok: true };
}
