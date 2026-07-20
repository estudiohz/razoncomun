import { createAdminClient } from '@/lib/supabase/admin';

export const PROVEEDORES_IA = ['anthropic', 'openai', 'google'] as const;
export type ProveedorIA = (typeof PROVEEDORES_IA)[number];

export const PROVEEDOR_LABEL: Record<ProveedorIA, string> = {
  anthropic: 'Anthropic (Claude)',
  openai: 'OpenAI (GPT)',
  google: 'Google (Gemini)',
};

export type CredencialIA = {
  id: string;
  provider: ProveedorIA;
  model: string;
  key_suffix: string;
  active: boolean;
  previous_credential_id: string | null;
  changed_by: string | null;
  changed_at: string;
  created_at: string;
};

/**
 * Lee el listado de credenciales de IA para pintar la UI del panel —
 * SIEMPRE con el cliente `service_role` (0016: RLS sin policies + REVOKE
 * explícito a anon/authenticated, ni un admin autenticado puede leer esta
 * tabla por REST con su propia sesión).
 *
 * ⚠️ Esta consulta NUNCA selecciona `api_key_encrypted` ni llama a
 * `ai_credentials_get_active` (esa función descifra) — solo columnas no
 * sensibles: proveedor, modelo, `key_suffix` (4 últimos caracteres en claro,
 * D-016) y metadatos de cambio. La clave completa no sale de la base jamás
 * por esta vía.
 */
export async function listarCredencialesIA(): Promise<CredencialIA[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('ai_provider_credentials')
    .select(
      'id, provider, model, key_suffix, active, previous_credential_id, changed_by, changed_at, created_at',
    )
    .order('changed_at', { ascending: false });

  if (error) {
    throw new Error(`No se pudieron leer las credenciales de IA: ${error.message}`);
  }
  return (data ?? []) as CredencialIA[];
}

export { nombresPorId } from './perfiles';
