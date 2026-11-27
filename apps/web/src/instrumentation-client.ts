// Sentry en el navegador (T-0097). Solo `NEXT_PUBLIC_SENTRY_DSN`, que Next
// incrusta al compilar (build arg en Dokploy). Sin DSN queda deshabilitado.
// Sin Session Replay ni User Feedback: no se añaden integraciones extra.
import * as Sentry from '@sentry/nextjs';
import { buildSentryOptions, registerPrivacyHooks } from '../sentry.common';

Sentry.init(
  buildSentryOptions({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
  }),
);
registerPrivacyHooks(Sentry.getClient());

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
