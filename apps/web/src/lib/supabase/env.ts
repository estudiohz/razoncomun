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

/**
 * URL de Supabase para las llamadas que salen del SERVIDOR (Server
 * Components, Server Actions, middleware, route handlers).
 *
 * POR QUÉ EXISTE. `NEXT_PUBLIC_SUPABASE_URL` es el dominio público
 * (`https://api.razoncomun.com`), y ese dominio está **proxeado por
 * Cloudflare**. Cuando el contenedor de Next lo usaba para hablar con su
 * propia base de datos, cada consulta salía del servidor, cruzaba hasta el
 * borde de Cloudflare y volvía a entrar por Traefik → Kong. Medido en
 * producción, 10 llamadas idénticas desde el contenedor:
 *
 *     por Cloudflare      mediana 250 ms  (picos de 1.149 ms)
 *     por la red interna  mediana  21 ms
 *
 * Una navegación del panel encadena ~7 idas y vueltas, así que el rodeo
 * costaba entre 1,5 y 4 segundos por clic. Con `SUPABASE_INTERNAL_URL`
 * apuntando al Kong del propio host (`http://rc-prod-supabase-kong:8000`)
 * la llamada no sale de la máquina.
 *
 * Es HTTP sin cifrar a propósito: el tráfico no abandona la red de Docker.
 *
 * ⚠️ NO usar esto para nada que acabe en el navegador o guardado en la base
 * de datos — una URL `http://rc-prod-supabase-kong:8000/...` no la puede
 * abrir nadie desde fuera. Para eso está `aUrlPublica()`, justo debajo.
 *
 * Si la variable no está, se usa la pública: en local y en cualquier
 * entorno sin red interna todo sigue funcionando igual que antes.
 */
export function urlSupabaseServidor(): string {
  return process.env.SUPABASE_INTERNAL_URL || urlSupabase();
}

/**
 * Devuelve una URL de Supabase en su forma PÚBLICA, alcanzable desde
 * cualquier navegador.
 *
 * El SDK construye las URLs de Storage (`getPublicUrl`) pegando la ruta a la
 * URL con la que se creó el cliente. Como el cliente del servidor ahora usa
 * la interna, sin esto las portadas del blog y las imágenes del cuerpo se
 * guardarían en la base de datos como `http://rc-prod-supabase-kong:8000/...`
 * y quedarían rotas **para siempre**, también para quien las mire dentro de
 * un año. Este rescribe el prefijo antes de que eso pase.
 */
export function aUrlPublica(url: string): string {
  const interna = process.env.SUPABASE_INTERNAL_URL;
  if (interna && url.startsWith(interna)) return urlSupabase() + url.slice(interna.length);
  return url;
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

/**
 * Origen PÚBLICO de la petición, para construir redirecciones absolutas.
 *
 * `new URL(request.url).origin` NO sirve tras un proxy (Traefik/Dokploy): en
 * el servidor standalone de Next refleja la dirección interna del contenedor
 * (`https://0.0.0.0:3000`, el HOSTNAME:PORT), y las redirecciones de auth
 * acababan mandando al usuario ahí. Se deriva de las cabeceras que pone el
 * proxy (`x-forwarded-host` / `x-forwarded-proto`), con respaldo a la URL
 * pública configurada. Robusto en cualquier entorno, incluido el corte de
 * dominio de la Ola 5.
 */
export function origenPublico(request: Request): string {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  if (host) return `${proto}://${host}`;
  return urlSitio();
}

/**
 * Clave maestra de cifrado de `ai_provider_credentials` (D-016,
 * 0016_ai_provider_credentials.sql). Vive SOLO en el entorno del servidor —
 * nunca se persiste en la BD, nunca se envía al navegador. Se pasa como
 * parámetro en cada llamada a `ai_credentials_set`/`ai_credentials_get_active`.
 * SOLO server-side: nunca importar `env.ts` desde un componente 'use client'
 * (ya se cumple hoy — todo lo que llama a esto vive en Server Actions).
 */
export function masterKeyCredencialesIA(): string {
  return requerida('AI_CREDENTIALS_MASTER_KEY', process.env.AI_CREDENTIALS_MASTER_KEY);
}
