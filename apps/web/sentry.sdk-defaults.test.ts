/**
 * T-0097 — prueba de integración con el SDK real y sus integraciones POR
 * DEFECTO del runtime Node (incluidas `requestDataIntegration` y las de HTTP),
 * que son las que inyectan IP, cabeceras, cookies y cuerpo. Se simula una
 * petición entrante dejando en el ámbito de aislamiento la petición
 * normalizada, como hace el SDK al recibir una petición HTTP. Transporte en
 * memoria: nada sale a la red.
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

describe('SDK real con integraciones por defecto (CA2/CA6)', () => {
  afterAll(async () => {
    await Sentry.close(0);
  });

  it('errores y transacciones salen sin IP, cookies, cuerpo ni email', async () => {
    const email = ['ana', 'ejemplo.es'].join('@');
    const ip = ['198', '51', '100', '23'].join('.');
    const cookieValue = 'sess-' + 'v'.repeat(12);
    const dsnKey = 'k'.repeat(8);
    // En tiempo de ejecución: ContextLines envía el código fuente del test.
    const opinion = ['apoyo', 'propuesta', 'secreta'].join('-');

    Sentry.init({
      ...buildSentryOptions({ dsn: `https://${dsnKey}@o0.ingest.sentry.io/1`, environment: 'production' }),
      tracesSampleRate: 1,
      transport: memoryTransport,
    });
    registerPrivacyHooks(Sentry.getClient());

    const names = (Sentry.getClient()?.getOptions().integrations ?? []).map((i) => i.name);
    expect(names).toContain('RequestData');

    await Sentry.withIsolationScope(async (scope) => {
      scope.setSDKProcessingMetadata({
        normalizedRequest: {
          method: 'POST',
          url: `https://razoncomun.com/afiliate?email=${email}`,
          query_string: `email=${email}`,
          headers: {
            cookie: `rc_session=${cookieValue}`,
            'x-forwarded-for': ip,
            referer: `https://razoncomun.com/p?email=${email}`,
            'user-agent': 'Mozilla/5.0',
            authorization: `Bearer ${cookieValue}`,
          },
          cookies: { rc_session: cookieValue },
          data: { email, opinion },
        },
        ipAddress: ip,
      });
      Sentry.startSpan({ name: `POST /afiliate?email=${email}`, op: 'http.server' }, () => {
        Sentry.captureException(new Error(`fallo para ${email}`));
      });
    });
    await Sentry.flush(2000);

    const all = sent.join('\n');
    expect(all).toContain('"type":"transaction"');
    expect(all).toContain('"exception"');
    for (const bad of [email, ip, cookieValue, 'rc_session', opinion, 'x-forwarded-for', 'referer']) {
      expect(all).not.toContain(bad);
    }
    expect(all).not.toContain('ip_address');
    expect(all).not.toContain('client.address');
  });
});
