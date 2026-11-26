// Sentry en el runtime Node.js (Server Components, Route Handlers, Server
// Actions). Lo carga `src/instrumentation.ts`. Sin DSN queda deshabilitado.
// Toda la limpieza RGPD vive en `sentry.common.ts`.
import * as Sentry from '@sentry/nextjs';
import { buildSentryOptions } from './sentry.common';

Sentry.init(
  buildSentryOptions({
    dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
  }),
);
