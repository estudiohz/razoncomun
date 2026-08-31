import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Credenciales de las pasarelas de pago (`payment_provider_credentials`, 0053).
 *
 * Se gestionan desde /admin/tienda/pagos en vez de por variables de entorno.
 * El secreto va cifrado en la base y la clave maestra vive SOLO aquí, en el
 * entorno del servidor: un volcado de Postgres sin ella no sirve de nada.
 *
 * ⚠️ `credencialActiva()` DESCIFRA. Llamarla únicamente en el momento de
 * hablar con la pasarela, jamás para responder a una petición de la UI. Para
 * pintar el panel está `resumenCredenciales()`, que no descifra nada.
 */

export type Pasarela = 'stripe' | 'paypal';

export class ClaveMaestraPagosAusenteError extends Error {
  constructor() {
    super(
      'Falta PAYMENT_CREDENTIALS_MASTER_KEY en el entorno del servidor: sin ella no se pueden ' +
        'guardar ni leer las credenciales de pago (migración 0053).',
    );
    this.name = 'ClaveMaestraPagosAusenteError';
  }
}

export function hayClaveMaestraPagos(): boolean {
  return Boolean(process.env.PAYMENT_CREDENTIALS_MASTER_KEY?.trim());
}

function claveMaestra(): string {
  const k = process.env.PAYMENT_CREDENTIALS_MASTER_KEY?.trim();
  if (!k) throw new ClaveMaestraPagosAusenteError();
  return k;
}

export interface CredencialPago {
  id: string;
  provider: Pasarela;
  mode: 'test' | 'live';
  secret: string;
  public_key: string;
  webhook_secret: string | null;
  key_suffix: string;
}

/** Lo que SÍ puede ver el panel: todo menos el secreto. */
export interface ResumenCredencial {
  provider: Pasarela;
  mode: 'test' | 'live';
  public_key: string;
  key_suffix: string;
  tiene_webhook: boolean;
  changed_at: string;
}

/**
 * Credencial activa de una pasarela, ya descifrada. `null` si no hay ninguna
 * guardada — que es lo normal hasta que alguien la pegue en el panel, y por
 * eso quien llama debe tener una reserva (hoy, la variable de entorno).
 */
export async function credencialActiva(provider: Pasarela): Promise<CredencialPago | null> {
  if (!hayClaveMaestraPagos()) return null;

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('payment_credentials_get_active', {
    p_provider: provider,
    p_master_key: claveMaestra(),
  });
  // Un error aquí casi siempre es "clave maestra equivocada" (pgp_sym_decrypt
  // lanza, no devuelve basura). Se propaga: descifrar mal y seguir sería
  // cobrar con una clave que no es.
  if (error) throw new Error(`No se ha podido leer la credencial de ${provider}: ${error.message}`);

  const fila = Array.isArray(data) ? data[0] : data;
  return (fila as CredencialPago | undefined) ?? null;
}

/** Estado de las pasarelas para el panel. NO descifra: no toca el secreto. */
export async function resumenCredenciales(): Promise<Map<Pasarela, ResumenCredencial>> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('payment_provider_credentials')
    .select('provider, mode, public_key, key_suffix, webhook_encrypted, changed_at')
    .eq('active', true);

  const mapa = new Map<Pasarela, ResumenCredencial>();
  for (const f of (data ?? []) as Record<string, unknown>[]) {
    mapa.set(f.provider as Pasarela, {
      provider: f.provider as Pasarela,
      mode: f.mode as 'test' | 'live',
      public_key: String(f.public_key ?? ''),
      key_suffix: String(f.key_suffix ?? ''),
      tiene_webhook: f.webhook_encrypted != null,
      changed_at: String(f.changed_at ?? ''),
    });
  }
  return mapa;
}

/** Guarda y activa una credencial. El modo de Stripe lo deriva la función SQL. */
export async function guardarCredencial(datos: {
  provider: Pasarela;
  secret: string;
  publicKey: string;
  webhook: string;
  mode: 'test' | 'live';
  actorId: string | null;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc('payment_credentials_set', {
    p_provider: datos.provider,
    p_secret: datos.secret,
    p_public_key: datos.publicKey,
    p_webhook: datos.webhook,
    p_mode: datos.mode,
    p_master_key: claveMaestra(),
    p_changed_by: datos.actorId,
  });
  if (error) throw new Error(error.message);
}

export interface MetodoPago {
  code: string;
  label: string;
  provider: Pasarela;
  enabled: boolean;
  position: number;
}

/**
 * Métodos de pago configurados.
 *
 * ⚠️ `enabled` aquí es un interruptor NUESTRO, no el de Stripe: apagarlo
 * quita el método del checkout, pero encenderlo no basta — hay que habilitarlo
 * también en el panel de Stripe o el pago falla con el cliente delante.
 */
export async function metodosPago(): Promise<MetodoPago[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('payment_methods')
    .select('code, label, provider, enabled, position')
    .order('position');
  return (data ?? []) as MetodoPago[];
}
