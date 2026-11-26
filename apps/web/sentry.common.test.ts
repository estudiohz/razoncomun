import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { Breadcrumb, ErrorEvent } from '@sentry/nextjs';
import {
  ALLOWED_HEADERS,
  REDACTED,
  beforeBreadcrumb,
  beforeSend,
  beforeSendSpan,
  beforeSendTransaction,
  buildSentryOptions,
  redact,
  scrubDsc,
  stripQuery,
  type TransactionEvent,
} from './sentry.common';

const ROOT = __dirname;
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// Valores sintéticos construidos en tiempo de ejecución (no son secretos reales).
const fakeKey = (prefix: string) => prefix + 'x'.repeat(24);
const fakeJwt = () => ['eyJ' + 'a'.repeat(10), 'b'.repeat(12), 'c'.repeat(8)].join('.');
const IP = ['203', '0', '113', '7'].join('.');

describe('redact (CA3)', () => {
  const cases: Array<[string, string]> = [
    ['email', 'usuario fulana.perez+rc@example.es falló'],
    ['DNI', 'dni 12345678Z inválido'],
    ['DNI con guion', 'dni 12345678-z inválido'],
    ['NIE', 'nie X1234567L'],
    ['NIF/CIF', 'cif B12345678'],
    ['IBAN con espacios', 'iban ES91 2100 0418 4502 0005 1332'],
    ['IBAN sin espacios', 'iban ES9121000418450200051332'],
    ['teléfono +34', 'tel +34 612 345 678'],
    ['teléfono móvil', 'tel 612345678'],
    ['teléfono fijo', 'tel 912 34 56 78'],
    ['JWT', `token ${fakeJwt()}`],
    ['sk_live', `clave ${fakeKey('sk_live_')}`],
    ['pk_test', `clave ${fakeKey('pk_test_')}`],
    ['whsec', `clave ${fakeKey('whsec_')}`],
  ];

  it.each(cases)('redacta %s', (_name, input) => {
    const out = redact(input);
    expect(out).toContain(REDACTED);
    // Ningún dígito de más de 3 seguidos ni el token debería sobrevivir.
    expect(out).not.toMatch(/\d{4,}/);
    expect(out).not.toMatch(/@|eyJ|sk_live|pk_test|whsec_/);
  });

  it('redacta Bearer conservando el prefijo', () => {
    const out = redact(`Authorization: Bearer ${'t'.repeat(30)}`);
    expect(out).toContain(`Bearer ${REDACTED}`);
    expect(out).not.toContain('t'.repeat(30));
  });

  it('deja intacto un texto sin datos', () => {
    const msg = "Cannot read properties of undefined (reading 'id')";
    expect(redact(msg)).toBe(msg);
  });
});

describe('stripQuery', () => {
  it('quita query y hash de URLs absolutas y relativas', () => {
    expect(stripQuery('https://razoncomun.com/a/b?x=1#h')).toBe('https://razoncomun.com/a/b');
    expect(stripQuery('/propuestas/x?slug=y')).toBe('/propuestas/x');
    expect(stripQuery('/a#frag')).toBe('/a');
    expect(stripQuery('no es url?x=1')).toBe('no es url');
    expect(stripQuery('/limpia')).toBe('/limpia');
  });
});

describe('beforeSend (CA2)', () => {
  it('elimina usuario, cookies, cuerpo, cabeceras no permitidas, query y datos en el mensaje', () => {
    const event = {
      event_id: 'e1',
      message: 'Fallo con DNI 12345678Z y IBAN ES91 2100 0418 4502 0005 1332',
      user: { id: 'u-1', email: 'a@b.es', ip_address: IP },
      server_name: 'rc-01',
      request: {
        url: 'https://razoncomun.com/propuestas/x?email=a@b.es&token=abc',
        query_string: 'email=a@b.es&token=abc',
        cookies: { 'sb-access-token': 'abc' },
        data: { email: 'a@b.es' },
        env: { REMOTE_ADDR: IP },
        headers: {
          Authorization: `Bearer ${'abc'}`,
          Cookie: 'sb=abc',
          'X-Forwarded-For': IP,
          'User-Agent': 'Mozilla/5.0',
          'Content-Type': 'application/json',
          'Accept-Language': 'es-ES',
        },
      },
    } as unknown as ErrorEvent;

    const out = beforeSend(event, {}) as ErrorEvent;
    expect(out).toBeTruthy();
    expect(out.user).toBeUndefined();
    expect(out.server_name).toBeUndefined();
    expect(out.request?.cookies).toBeUndefined();
    expect(out.request?.data).toBeUndefined();
    expect(out.request?.query_string).toBeUndefined();
    expect(out.request?.env).toBeUndefined();
    expect(Object.keys(out.request?.headers ?? {}).sort()).toEqual(
      ['accept-language', 'content-type', 'user-agent'],
    );
    expect(out.request?.url).toBe('https://razoncomun.com/propuestas/x');

    const json = JSON.stringify(out);
    for (const bad of ['a@b.es', '12345678Z', 'ES91', 'abc', 'Authorization', 'authorization', IP]) {
      expect(json).not.toContain(bad);
    }
  });

  it('borra contexts.user y redacta extra, contexts y tags', () => {
    const out = beforeSend(
      {
        contexts: { user: { id: 'x' }, app: { note: 'a@b.es' } as Record<string, unknown> },
        extra: { who: 'mail a@b.es' },
        tags: { dni: '12345678Z' },
        logentry: { message: 'hola a@b.es %s', params: ['12345678Z', 3] },
      } as unknown as ErrorEvent,
      {},
    ) as ErrorEvent;
    const json = JSON.stringify(out);
    expect(out.contexts?.user).toBeUndefined();
    expect(json).not.toContain('a@b.es');
    expect(json).not.toContain('12345678Z');
  });
});

describe('excepciones (CA4)', () => {
  it('redacta values[].value y borra frames[].vars', () => {
    const out = beforeSend(
      {
        exception: {
          values: [
            {
              type: 'Error',
              value: 'No existe el afiliado a@b.es (12345678Z)',
              stacktrace: { frames: [{ filename: 'a.js', vars: { email: 'a@b.es' } }] },
            },
          ],
        },
      } as unknown as ErrorEvent,
      {},
    ) as ErrorEvent;
    const ex = out.exception!.values![0];
    expect(ex.value).toBe(`No existe el afiliado ${REDACTED} (${REDACTED})`);
    expect(ex.stacktrace!.frames![0].vars).toBeUndefined();
    expect(ex.stacktrace!.frames![0].filename).toBe('a.js');
  });
});

describe('migas (CA5)', () => {
  const crumbs = (): Breadcrumb[] => [
    {
      category: 'navigation',
      message: 'nav de a@b.es',
      data: { from: '/entrar?token=abc', to: '/panel?email=a@b.es' },
    },
    {
      category: 'fetch',
      data: { method: 'GET', status_code: 200, url: '/api/x?email=a@b.es', body: 'a@b.es' },
    },
    {
      category: 'xhr',
      data: { method: 'POST', status_code: 500, url: 'https://api.razoncomun.com/r?email=a@b.es', extra: 'x' },
    },
  ];

  const check = (list: Breadcrumb[]) => {
    const [nav, fetchC, xhr] = list;
    expect(nav.data).toEqual({ from: '/entrar', to: '/panel' });
    expect(nav.message).toBe(`nav de ${REDACTED}`);
    expect(fetchC.data).toEqual({ method: 'GET', status_code: 200, url: '/api/x' });
    expect(xhr.data).toEqual({ method: 'POST', status_code: 500, url: 'https://api.razoncomun.com/r' });
    const json = JSON.stringify(list);
    expect(json).not.toContain('a@b.es');
    expect(json).not.toContain('abc');
  };

  it('beforeBreadcrumb limpia cada miga', () => {
    check(crumbs().map((c) => beforeBreadcrumb(c) as Breadcrumb));
  });

  it('beforeSend limpia las migas del evento', () => {
    const out = beforeSend({ breadcrumbs: crumbs() } as unknown as ErrorEvent, {}) as ErrorEvent;
    check(out.breadcrumbs!);
  });
});

describe('beforeSendTransaction (CA6)', () => {
  it('aplica la misma limpieza a transacciones y spans', () => {
    const tx = {
      type: 'transaction',
      transaction: '/propuestas/x?slug=y',
      user: { email: 'a@b.es', ip_address: IP },
      request: { url: 'https://razoncomun.com/propuestas/x?slug=y', headers: { cookie: 'a=b' } },
      spans: [
        {
          span_id: 's1',
          trace_id: 't1',
          start_timestamp: 0,
          description: 'GET https://api.x/y?email=a@b.es',
          data: {
            url: 'https://api.x/y?email=a@b.es',
            'http.url': 'https://api.x/y?email=a@b.es',
            'url.full': 'https://api.x/y?email=a@b.es',
            'http.query': '?email=a@b.es',
            'url.query': '?email=a@b.es',
            'http.method': 'GET',
          },
        },
      ],
    } as unknown as TransactionEvent;

    const out = beforeSendTransaction(tx, {}) as TransactionEvent;
    expect(out.user).toBeUndefined();
    expect(out.transaction).toBe('/propuestas/x');
    expect(out.request?.url).toBe('https://razoncomun.com/propuestas/x');
    expect(out.request?.headers).toEqual({});
    const span = out.spans![0];
    expect(span.description).toBe('GET https://api.x/y');
    expect(span.data).toEqual({
      url: 'https://api.x/y',
      'http.url': 'https://api.x/y',
      'url.full': 'https://api.x/y',
      'http.method': 'GET',
    });
    const json = JSON.stringify(out);
    expect(json).not.toContain('a@b.es');
    expect(json).not.toContain('slug=y');
    expect(json).not.toContain(IP);
  });
});

describe('beforeSendSpan y DSC (CA6)', () => {
  it('beforeSendSpan limpia descripción y atributos del span', () => {
    const span = {
      span_id: 's1',
      trace_id: 't1',
      start_timestamp: 0,
      status: 'ok',
      description: 'GET https://api.x/y?email=a@b.es',
      data: { 'url.full': 'https://api.x/y?email=a@b.es', 'url.query': '?email=a@b.es', nota: 'tel 612345678' },
    };
    const out = beforeSendSpan(span as never) as unknown as typeof span;
    expect(out.description).toBe('GET https://api.x/y');
    expect(Object.keys(out.data)).toEqual(['url.full', 'nota']);
    expect(out.data['url.full']).toBe('https://api.x/y');
    expect(out.data.nota).toContain(REDACTED);
    expect(out.data.nota).not.toContain('612345678');
  });

  it('scrubDsc quita la query del nombre de transacción', () => {
    const dsc = { trace_id: 't', public_key: 'k', transaction: 'GET /p?email=a@b.es' };
    scrubDsc(dsc);
    expect(dsc.transaction).toBe('GET /p');
  });
});

describe('buildSentryOptions (CA7)', () => {
  it('sin DSN queda deshabilitado, en development y sin trazas', () => {
    const o = buildSentryOptions({});
    expect(o.enabled).toBe(false);
    expect(o.environment).toBe('development');
    expect(o.tracesSampleRate).toBe(0);
    expect(o.sendDefaultPii).toBe(false);
  });

  it('con DSN en production se habilita con 10% de trazas', () => {
    const o = buildSentryOptions({ dsn: 'https://k@o0.ingest.sentry.io/1', environment: 'production' });
    expect(o.enabled).toBe(true);
    expect(o.environment).toBe('production');
    expect(o.tracesSampleRate).toBe(0.1);
    expect(o.sendDefaultPii).toBe(false);
  });

  it('nunca lleva profiling, replays ni integraciones extra, y trae los hooks', () => {
    for (const o of [buildSentryOptions({}), buildSentryOptions({ dsn: 'x', environment: 'production' })]) {
      const keys = Object.keys(o);
      expect(keys).not.toContain('profilesSampleRate');
      expect(keys).not.toContain('integrations');
      expect(keys.some((k) => k.startsWith('replays'))).toBe(false);
      expect(o.beforeSend).toBe(beforeSend);
      expect(o.beforeSendTransaction).toBe(beforeSendTransaction);
      expect(o.beforeBreadcrumb).toBe(beforeBreadcrumb);
      expect(o.beforeSendSpan).toBe(beforeSendSpan);
      // Con el modo por defecto ('stream') el SDK ignora beforeSendTransaction.
      expect(o.traceLifecycle).toBe('static');
    }
  });

  it('la lista blanca de cabeceras es la acordada', () => {
    expect([...ALLOWED_HEADERS].sort()).toEqual(['accept-language', 'content-type', 'user-agent']);
  });
});

describe('cableado estático (CA8–CA12)', () => {
  it('CA8: instrumentation y configs de runtime', () => {
    const inst = read('src/instrumentation.ts');
    expect(inst).toMatch(/export\s+async\s+function\s+register/);
    expect(inst).toMatch(/export\s+const\s+onRequestError\s*=\s*Sentry\.captureRequestError/);
    expect(inst).toContain("'../sentry.server.config'");
    expect(inst).toContain("'../sentry.edge.config'");

    const client = read('src/instrumentation-client.ts');
    expect(client).toContain('process.env.NEXT_PUBLIC_SENTRY_DSN');
    expect(client).not.toMatch(/process\.env\.SENTRY_DSN/);
    expect(client).toContain('registerPrivacyHooks(Sentry.getClient())');
    expect(client).toMatch(/onRouterTransitionStart\s*=\s*Sentry\.captureRouterTransitionStart/);

    for (const f of ['sentry.server.config.ts', 'sentry.edge.config.ts']) {
      const src = read(f);
      expect(src).toMatch(/process\.env\.SENTRY_DSN\s*\|\|\s*process\.env\.NEXT_PUBLIC_SENTRY_DSN/);
      expect(src).toContain('buildSentryOptions');
      expect(src).toContain('registerPrivacyHooks(Sentry.getClient())');
    }
  });

  it('CA9: ni setUser, ni replay, ni feedback, ni profiling', () => {
    const forbidden = /setUser|replayIntegration|feedbackIntegration|profilesSampleRate/;
    const self = path.join(ROOT, 'sentry.common.test.ts');
    const skip = new Set(['node_modules', '.next', 'e2e', 'public', '.git']);
    const hits: string[] = [];
    const walk = (dir: string, recurse: boolean) => {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) {
          if (recurse && !skip.has(ent.name)) walk(p, true);
        } else if (/\.(ts|tsx|js|mjs|cjs)$/.test(ent.name) && p !== self) {
          if (forbidden.test(fs.readFileSync(p, 'utf8'))) hits.push(path.relative(ROOT, p));
        }
      }
    };
    walk(ROOT, false);
    walk(path.join(ROOT, 'src'), true);
    expect(hits).toEqual([]);
  });

  it('CA10: next.config envuelve con withSentryConfig y conserva la config', () => {
    const cfg = read('next.config.mjs');
    expect(cfg).toContain('withSentryConfig(nextConfig');
    expect(cfg).toContain("output: 'standalone'");
    expect(cfg).toContain("bodySizeLimit: '25mb'");
    expect(cfg).toContain('remotePatterns');
    expect(cfg).toContain("source: '/afiliate'");
    expect(cfg).toContain("source: '/afiliate/:path*'");
    expect(cfg).toMatch(/disable:\s*!process\.env\.SENTRY_AUTH_TOKEN/);
    expect(cfg).not.toContain('productionBrowserSourceMaps');
    expect(cfg).not.toContain('tunnelRoute');
  });

  it('CA10: sourcemaps.disable es true sin SENTRY_AUTH_TOKEN', async () => {
    const prev = process.env.SENTRY_AUTH_TOKEN;
    delete process.env.SENTRY_AUTH_TOKEN;
    try {
      const mod = await import('./next.config.mjs');
      expect(mod.sentryBuildOptions.sourcemaps?.disable).toBe(true);
      expect(mod.sentryBuildOptions.sourcemaps?.deleteSourcemapsAfterUpload).toBe(true);
      expect(mod.nextConfig.output).toBe('standalone');
    } finally {
      if (prev !== undefined) process.env.SENTRY_AUTH_TOKEN = prev;
    }
  });

  it('CA11: Dockerfile declara los build args antes del build', () => {
    const df = read('Dockerfile');
    const builder = df.slice(df.indexOf('AS builder'), df.indexOf('AS runner'));
    const build = builder.indexOf('RUN npm run build');
    for (const s of [
      'ARG NEXT_PUBLIC_SENTRY_DSN',
      'ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT',
      'ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN',
      'ENV NEXT_PUBLIC_SENTRY_ENVIRONMENT=$NEXT_PUBLIC_SENTRY_ENVIRONMENT',
    ]) {
      const i = builder.indexOf(s);
      expect(i, s).toBeGreaterThan(-1);
      expect(i, s).toBeLessThan(build);
    }
    const runner = df.slice(df.indexOf('AS runner'));
    expect(runner).not.toContain('SENTRY_AUTH_TOKEN');
  });

  it('CA12: global-error es client component y no pinta error.message', () => {
    const ge = read('src/app/global-error.tsx');
    expect(ge.trimStart().startsWith("'use client'")).toBe(true);
    expect(ge).toContain('Sentry.captureException(error)');
    expect(ge).not.toContain('error.message');
    expect(ge).not.toMatch(/setUser/);
  });
});
