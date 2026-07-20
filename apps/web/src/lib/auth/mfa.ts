import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Ayudas de 2FA (TOTP) sobre Supabase Auth. `getAuthenticatorAssuranceLevel`
 * decodifica el JWT localmente (no hace red): aal1 = solo contraseña/email,
 * aal2 = con segundo factor verificado en esta sesión.
 */
export async function obtenerAal(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) return { actual: 'aal1' as const, siguiente: 'aal1' as const };
  return {
    actual: (data.currentLevel ?? 'aal1') as 'aal1' | 'aal2',
    siguiente: (data.nextLevel ?? 'aal1') as 'aal1' | 'aal2',
  };
}

/** true si el usuario tiene al menos un factor TOTP verificado (independientemente del aal actual de esta sesión). */
export async function tieneFactorVerificado(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error || !data) return false;
  return data.totp.some((f) => f.status === 'verified');
}
