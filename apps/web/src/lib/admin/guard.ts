import { cache } from 'react';
import { redirect } from 'next/navigation';
import { requireUsuario } from '@/lib/auth/niveles';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Roles de app del usuario, una sola vez por petición.
 *
 * `is_admin` e `is_editor` son dos RPC, y se preguntaban en cada guard: el
 * layout de `/admin` los pedía, y cualquier página que además llamase a
 * `requireAdmin` los volvía a pedir. Con `cache()` (ámbito: la petición en
 * curso) se resuelven una vez y se reparten.
 *
 * La clave del memo es el `userId` — una cadena — a propósito: si se pasara
 * el cliente de Supabase como argumento, cada llamada traería un objeto
 * distinto y el memo no acertaría nunca.
 */
const rolesDe = cache(async (userId: string) => {
  const supabase = await createClient();
  const [{ data: esAdmin }, { data: esEditor }] = await Promise.all([
    supabase.rpc('is_admin', { p_user: userId }),
    supabase.rpc('is_editor', { p_user: userId }),
  ]);
  return { esAdmin: Boolean(esAdmin), esEditor: Boolean(esEditor) };
});

/**
 * Guard de acceso al panel `/admin` (rc-09). Complementa (no sustituye) al
 * middleware de rc-03 (`src/middleware.ts`), que ya exige 2FA (aal2) a
 * cualquier usuario con rol admin/editor o cargo vigente antes de dejarle
 * renderizar nada bajo `/admin`.
 *
 * Lo que faltaba: el middleware SOLO exige 2FA cuando `requiereMfa()` es
 * true (admin/editor/cargo). Un usuario autenticado SIN ninguno de esos
 * roles (p. ej. un `member` de a pie) no dispara esa condición y pasaría
 * el middleware sin más — por eso el propio layout de `/admin` (que llama
 * a esta función) es la segunda puerta: exige explícitamente rol de app
 * `admin` o `editor`. Sin ninguno de los dos, fuera — ni por URL directa.
 *
 * La RLS de cada tabla es la última línea de defensa real (C3); esto es
 * UX/routing para no enseñar ni el esqueleto del panel a quien no toca.
 */
export async function requireAdminOrEditor(rutaVuelta = '/admin') {
  const { user, perfil, supabase } = await requireUsuario(rutaVuelta);
  const { esAdmin, esEditor } = await rolesDe(user.id);

  if (!esAdmin && !esEditor) {
    redirect('/');
  }

  return { user, perfil: perfil!, supabase, esAdmin, esEditor };
}

/** Variante que exige admin (no basta editor) — para acciones exclusivas de admin. */
export async function requireAdmin(rutaVuelta = '/admin') {
  const { user, perfil, supabase } = await requireUsuario(rutaVuelta);
  const { esAdmin } = await rolesDe(user.id);
  if (!esAdmin) redirect('/admin');
  return { user, perfil: perfil!, supabase };
}

/** true si `userId` es admin (uso puntual fuera de un guard de página). */
export async function esAdminUsuario(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase.rpc('is_admin', { p_user: userId });
  return Boolean(data);
}
