/**
 * Clave publicable de Stripe — el ÚNICO dato de Stripe que puede vivir en un
 * módulo importable desde el cliente. Deliberadamente separado de
 * `lib/stripe/config.ts` (que importa el SDK de servidor `stripe` y no debe
 * entrar jamás en el bundle del navegador): este archivo no importa nada de
 * `stripe`, así que Next.js puede incluirlo en Client Components sin arrastrar
 * código de servidor.
 *
 * `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` se referencia aquí de forma textual
 * para que el compilador de Next la sustituya en build time.
 */
export function stripePublishableKey(): string {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) {
    throw new Error(
      'Falta NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY. Añádela a .env.local (clave test pk_test_... de Sergio).',
    );
  }
  return key;
}
