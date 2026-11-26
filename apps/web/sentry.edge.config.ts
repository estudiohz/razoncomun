// Sentry en el runtime edge (middleware y rutas con `runtime = 'edge'`).
// Lo carga `src/instrumentation.ts`. Sin DSN queda deshabilitado.
import * as Sentry from '@sentry/nextjs';
import { buildSentryOptions } from './sentry.common';

Sentry.init(
  buildSentryOptions({
    dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
  }),
);
