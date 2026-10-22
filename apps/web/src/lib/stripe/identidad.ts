import { createAdminClient } from '@/lib/supabase/admin';

export type EstadoIdentidad = 'ninguno' | 'en_revision' | 'rechazado' | 'cancelado' | 'sin_socio';

/** Motivos de `last_error.reason` de Stripe Identity, en lenguaje llano. */
const MOTIVOS: Record<string, string> = {
  document_expired: 'El documento está caducado.',
  document_type_not_supported: 'Ese tipo de documento no se admite. Usa DNI, NIE o pasaporte.',
  document_unverified_other: 'No hemos podido verificar el documento.',
  selfie_document_missing_photo: 'El documento no tiene foto con la que comparar el selfie.',
  selfie_face_mismatch: 'El selfie no coincide con la foto del documento.',
  selfie_manipulated: 'No hemos podido validar el selfie.',
  selfie_unverified_other: 'No hemos podido verificar el selfie.',
};

/**
 * Último resultado de verificación de identidad de una persona, leído del
 * `audit_log` (solo lo lee el admin por RLS, de ahí `createAdminClient`: esta
 * función solo debe llamarse con el id del usuario ya autenticado).
 * No guarda ni expone nada del documento: solo el veredicto.
 */
export async function estadoIdentidad(
  userId: string,
): Promise<{ estado: EstadoIdentidad; motivo: string | null }> {
  const { data } = await createAdminClient()
    .from('audit_log')
    .select('action, meta')
    .eq('entity', 'stripe_identity_event')
    .eq('meta->>user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  switch (data?.action) {
    case 'stripe_identity_session_creada':
      return { estado: 'en_revision', motivo: null };
    case 'stripe_identity_requires_input': {
      const razon = (data.meta as { last_error?: string | null } | null)?.last_error;
      return { estado: 'rechazado', motivo: (razon && MOTIVOS[razon]) || null };
    }
    case 'stripe_identity_canceled':
      return { estado: 'cancelado', motivo: null };
    case 'stripe_identity_verified_sin_socio':
      return { estado: 'sin_socio', motivo: null };
    default:
      return { estado: 'ninguno', motivo: null };
  }
}
