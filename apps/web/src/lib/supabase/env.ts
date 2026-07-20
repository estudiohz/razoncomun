/**
 * Lectura centralizada y validada de las variables de entorno de Supabase.
 * Cualquier cliente (browser/server/admin) pasa por aquí — un solo sitio
 * donde falla rápido y con un mensaje claro si falta algo.
 */

function requerida(nombre: string, valor: string | undefined): string {
  if (!valor) {
    throw new Error(
      `Falta la variable de entorno ${nombre}. Revisa apps/web/.env.local (ver AUTH-SETUP.md).`,
    );
  }
  return valor;
}

export function urlSupabase(): string {
  return requerida('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function anonKeySupabase(): string {
  return requerida('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** SOLO server-side. Nunca importar desde un componente/archivo 'use client'. */
export function serviceRoleKeySupabase(): string {
  return requerida('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function urlSitio(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}
