// Arranque de Sentry en servidor (T-0097). Next llama a `register()` una vez
// por runtime; `onRequestError` captura los errores de render/handlers.
// Ver `SENTRY.md` y la limpieza RGPD en `sentry.common.ts`.
import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
