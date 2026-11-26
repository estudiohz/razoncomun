/**
 * T-0097 — prueba de integración con el SDK real: comprueba que `Sentry.init`
 * con `buildSentryOptions` INVOCA de verdad la limpieza de transacciones y
 * spans (con el `traceLifecycle` por defecto, 'stream', el SDK ignoraría
 * `beforeSendTransaction`). Transporte en memoria: nada sale a la red.
 */
import { afterAll, describe, expect, it } from 'vitest';
import * as Sentry from '@sentry/nextjs';
import { buildSentryOptions, registerPrivacyHooks } from './sentry.common';

const sent: string[] = [];
const memoryTransport = (options: Parameters<typeof Sentry.createTransport>[0]) =>
  Sentry.createTransport(options, async (req) => {
    const body = typeof req.body === 'string' ? req.body : new TextDecoder().decode(req.body);
    sent.push(body);
    return { statusCode: 200 };
  });

describe('SDK real con buildSentryOptions (CA6)', () => {
  afterAll(async () => {
    await Sentry.close(0);
  });

  it('las transacciones y sus spans salen sin query ni datos personales', async () => {
    const email = ['ana', 'ejemplo.es'].join('@');
    const dsnKey = 'k'.repeat(8);
    Sentry.init({
      ...buildSentryOptions({ dsn: `https://${dsnKey}@o0.ingest.sentry.io/1`, environment: 'production' }),
      tracesSampleRate: 1,
      transport: memoryTransport,
      defaultIntegrations: false,
    });
    registerPrivacyHooks(Sentry.getClient());

    Sentry.startSpan(
      { name: `GET /propuestas/x?email=${email}`, attributes: { 'url.full': `https://razoncomun.com/p?email=${email}` } },
      () => {
        Sentry.startSpan(
          {
            name: `GET https://api.x/y?email=${email}`,
            op: 'http.client',
            attributes: {
              'url.full': `https://api.x/y?email=${email}`,
              'http.query': `?email=${email}`,
              'nota': `contacto ${email}`,
            },
          },
          () => undefined,
        );
      },
    );
    await Sentry.flush(2000);

    const all = sent.join('\n');
    expect(all).toContain('"type":"transaction"');
    expect(all).toContain('https://api.x/y');
    expect(all).not.toContain(email);
    expect(all).not.toContain('email=');
    expect(all).not.toContain('http.query');
  });
});
