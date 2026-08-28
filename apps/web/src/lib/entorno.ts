/**
 * Modo "entorno cerrado": la web entera queda tras la puerta del login y no es
 * rastreable por buscadores.
 *
 * Para qué: `dev.razoncomun.com` sirve el MISMO código y contenido que
 * producción. Sin esto, Google indexa el entorno de desarrollo y acaba
 * compitiendo con la web real por las mismas búsquedas (contenido duplicado),
 * además de exponer al público borradores y pruebas.
 *
 * Se activa con la variable de entorno `RC_ENTORNO_CERRADO=true`. Es
 * **server-only** a propósito (sin `NEXT_PUBLIC_`): así no viaja al navegador
 * y no se puede desactivar desde el cliente. Producción simplemente no la
 * define.
 *
 * OJO: esto es una puerta de acceso, no la autoridad. Quien decide qué puede
 * leer cada usuario siguen siendo las políticas RLS.
 */
export function entornoCerrado(): boolean {
  return process.env.RC_ENTORNO_CERRADO === 'true';
}
