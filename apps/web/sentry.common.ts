/**
 * Configuración compartida de Sentry para los tres runtimes (node, edge y
 * navegador) — T-0097.
 *
 * La web trata opinión política y afiliación (RGPD Art. 9): NINGÚN dato
 * personal puede salir hacia Sentry. Todo evento y toda transacción pasa por
 * `scrubEvent` antes de enviarse, y cada miga por `scrubBreadcrumb` al
 * registrarse. Sin DSN, Sentry queda deshabilitado (`enabled: false`).
 *
 * Este módulo es lógica pura (de `@sentry/nextjs` solo usa tipos y el marcador
 * `withStaticSpan`), testeable en entorno node sin mocks (ver
 * `sentry.common.test.ts`).
 *
 * `traceLifecycle: 'static'`: en @sentry/nextjs 11 el modo por defecto es
 * `'stream'`, en el que el SDK IGNORA `beforeSendTransaction` y los spans
 * saldrían sin limpiar. En modo estático pasan por `beforeSendTransaction` y,
 * además, cada span (raíz incluida) por `beforeSendSpan`.
 * Prohibido identificar al usuario en Sentry, Session Replay, User Feedback y
 * profiling (ver `SENTRY.md`).
 */
import { withStaticSpan } from '@sentry/nextjs';
import type * as SentryNext from '@sentry/nextjs';
import type {
  Breadcrumb,
  ErrorEvent,
  Event,
  EventHint,
} from '@sentry/nextjs';

/** Forma estática de un span (`SpanJSON` de `@sentry/core`, no reexportado). */
type StaticSpanJSON = Parameters<Parameters<typeof withStaticSpan>[0]>[0];
/** Cliente de Sentry (`Client` de `@sentry/core`, no reexportado como tipo). */
type SentryClient = ReturnType<typeof SentryNext.getClient>;

/** Igual que `TransactionEvent` de `@sentry/core` (no lo reexporta `@sentry/nextjs`). */
export type TransactionEvent = Event & { type: 'transaction' };

export const REDACTED = '[redactado]';

/**
 * Patrones a redactar. El orden importa: tokens (JWT, claves, Bearer) antes
 * que IBAN, documentos y teléfonos, para no dejar un token roto a medias.
 */
const PATTERNS: Array<[RegExp, string]> = [
  // Bearer <token> → conserva el prefijo para que el mensaje siga siendo legible.
  [/\bBearer\s+[A-Za-z0-9._~+/=-]+/g, `Bearer ${REDACTED}`],
  // JWT y cualquier cosa que empiece por eyJ (base64 de '{"').
  [/eyJ[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*/g, REDACTED],
  // Claves de Stripe y similares: sk_, pk_, rk_, whsec_.
  [/\b(?:sk|pk|rk|whsec)_[A-Za-z0-9_]+/g, REDACTED],
  // Direcciones IP (v4 y v6, completas o abreviadas con `::`).
  [/\b(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}\b/g, REDACTED],
  [/\b(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}\b/gi, REDACTED],
  [/\b(?:[0-9a-f]{1,4}:){1,6}(?::[0-9a-f]{1,4}){1,6}\b/gi, REDACTED],
  // Emails.
  [/[^\s@]+@[^\s@]+\.[^\s@]+/g, REDACTED],
  // IBAN (con y sin espacios/guiones).
  [/\b[A-Z]{2}\d{2}(?:[ -]?[A-Z0-9]{4}){2,7}(?:[ -]?[A-Z0-9]{1,4})?\b/gi, REDACTED],
  // NIE.
  [/\b[XYZ][-\s]?\d{7}[-\s]?[A-Z]\b/gi, REDACTED],
  // DNI.
  [/\b\d{8}[-\s]?[A-HJ-NP-TV-Z]\b/gi, REDACTED],
  // NIF/CIF de persona jurídica.
  [/\b[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]\b/gi, REDACTED],
  // Teléfonos españoles, con o sin prefijo y con espacios/guiones.
  [/(?:\+34|\b0034)?[\s-]?\b[6789]\d{2}[\s-]?\d{3}[\s-]?\d{3}\b/g, REDACTED],
  [/(?:\+34|\b0034)?[\s-]?\b[6789]\d{2}[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2}\b/g, REDACTED],
  [/\b[6789]\d{8}\b/g, REDACTED],
];

/** Sustituye por `[redactado]` cualquier dato personal o secreto reconocible. */
export function redact(text: string): string {
  if (typeof text !== 'string' || text === '') return text;
  let out = text;
  for (const [re, rep] of PATTERNS) out = out.replace(re, rep);
  return out;
}

/** Devuelve la URL sin query string ni fragmento (absoluta o relativa). */
export function stripQuery(url: string): string {
  if (typeof url !== 'string') return url;
  try {
    const u = new URL(url);
    return `${u.origin === 'null' ? `${u.protocol}//${u.host}` : u.origin}${u.pathname}`;
  } catch {
    const i = url.search(/[?#]/);
    return i === -1 ? url : url.slice(0, i);
  }
}

export const ALLOWED_HEADERS = ['user-agent', 'content-type', 'accept-language'] as const;
const ALLOWED_HEADER_SET = new Set<string>(ALLOWED_HEADERS);

const URL_DATA_KEYS = ['url', 'from', 'to'] as const;
const NETWORK_CATEGORIES = new Set(['fetch', 'xhr']);
const SPAN_URL_KEYS = ['url', 'http.url', 'url.full'] as const;
const SPAN_QUERY_KEYS = ['http.query', 'url.query'] as const;

/**
 * Atributos de span que pueden llevar IP, cabeceras, cookies, cuerpos o datos
 * de usuario (los añaden `httpServerSpansIntegration`, `requestDataIntegration`
 * y la instrumentación de fetch/undici). Se borran siempre.
 */
const SPAN_DROP_KEYS = new Set([
  'client.address',
  'client.port',
  'network.peer.address',
  'network.peer.port',
  'network.local.address',
  'url.fragment',
  'http.client_ip',
  'net.peer.ip',
  'net.sock.peer.addr',
  'enduser.id',
]);
const TRACE_ID_KEYS = new Set(['trace_id', 'span_id', 'parent_span_id']);
const SPAN_DROP_PREFIXES = ['http.request.body', 'http.response.body', 'user.', 'enduser.'];
/** Cabeceras como atributo de span: solo se conservan las de la lista blanca. */
const SPAN_HEADER_PREFIXES = ['http.request.header.', 'http.response.header.'];

type Dict = Record<string, unknown>;

const isDict = (v: unknown): v is Dict => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Redacta en profundidad cualquier valor: strings, arrays (p. ej. los
 * atributos `string[]` de los spans) y objetos anidados. Devuelve el valor
 * limpio; los objetos y arrays se limpian in situ.
 */
export function redactDeep(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return redact(value);
  if (depth > 8 || typeof value !== 'object' || value === null) return value;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) value[i] = redactDeep(value[i], depth + 1);
    return value;
  }
  const obj = value as Dict;
  for (const [k, v] of Object.entries(obj)) obj[k] = redactDeep(v, depth + 1);
  return obj;
}

/** Redacta todos los strings de un objeto, a cualquier profundidad (in situ). */
function redactAll(obj: Dict | undefined): void {
  if (obj) redactDeep(obj);
}

/** Limpia una miga: URLs sin query, mensaje redactado, `data` mínima en red. */
export function scrubBreadcrumb(crumb: Breadcrumb): Breadcrumb {
  if (typeof crumb.message === 'string') crumb.message = redact(crumb.message);
  const data = crumb.data as Dict | undefined;
  if (data) {
    if (crumb.category && NETWORK_CATEGORIES.has(crumb.category)) {
      const clean: Dict = {};
      if (data.method !== undefined) clean.method = data.method;
      if (data.status_code !== undefined) clean.status_code = data.status_code;
      if (typeof data.url === 'string') clean.url = stripQuery(data.url);
      crumb.data = clean;
    } else {
      for (const k of URL_DATA_KEYS) {
        if (typeof data[k] === 'string') data[k] = stripQuery(data[k] as string);
      }
      redactAll(data);
    }
  }
  return crumb;
}

function scrubRequest(event: Event): void {
  const req = event.request;
  if (!req) return;
  delete req.cookies;
  delete req.data;
  delete req.query_string;
  delete req.env;
  if (req.headers) {
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      const key = k.toLowerCase();
      if (ALLOWED_HEADER_SET.has(key) && typeof v === 'string') headers[key] = redact(v);
    }
    req.headers = headers;
  }
  if (typeof req.url === 'string') req.url = stripQuery(req.url);
}

/** Limpia los atributos de un span: URLs sin query, sin `*.query`, strings redactados. */
function scrubSpanData(data: Dict | undefined): void {
  if (!data) return;
  for (const k of Object.keys(data)) {
    const key = k.toLowerCase();
    if (SPAN_DROP_KEYS.has(key) || SPAN_DROP_PREFIXES.some((p) => key.startsWith(p))) {
      delete data[k];
      continue;
    }
    const headerPrefix = SPAN_HEADER_PREFIXES.find((p) => key.startsWith(p));
    if (headerPrefix) {
      const header = key.slice(headerPrefix.length).replace(/_/g, '-');
      if (!headerPrefix.startsWith('http.request.') || !ALLOWED_HEADER_SET.has(header)) delete data[k];
    }
  }
  for (const k of SPAN_URL_KEYS) {
    if (typeof data[k] === 'string') data[k] = stripQuery(data[k] as string);
  }
  for (const k of SPAN_QUERY_KEYS) delete data[k];
  redactAll(data);
}

/** Limpia un span en formato estático (in situ). */
export function scrubSpan<T extends StaticSpanJSON>(span: T): T {
  if (typeof span.description === 'string') span.description = redact(stripQuery(span.description));
  scrubSpanData(span.data as Dict | undefined);
  return span;
}

function scrubSpans(event: Event): void {
  for (const span of event.spans ?? []) scrubSpan(span);
  scrubSpanData(event.contexts?.trace?.data as Dict | undefined);
}

/** Quita todo dato personal de un evento de error o de transacción (in situ). */
export function scrubEvent<T extends Event>(event: T): T {
  delete event.user;
  delete event.server_name;

  scrubRequest(event);

  if (typeof event.message === 'string') event.message = redact(event.message);
  if (event.logentry) {
    if (typeof event.logentry.message === 'string') event.logentry.message = redact(event.logentry.message);
    if (Array.isArray(event.logentry.params)) {
      event.logentry.params = event.logentry.params.map((p) => (typeof p === 'string' ? redact(p) : p));
    }
  }

  for (const ex of event.exception?.values ?? []) {
    if (typeof ex.value === 'string') ex.value = redact(ex.value);
    for (const frame of ex.stacktrace?.frames ?? []) delete frame.vars;
  }

  if (event.breadcrumbs) event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb);

  redactAll(event.extra as Dict | undefined);
  if (event.contexts) {
    delete event.contexts.user;
    for (const ctx of Object.values(event.contexts)) {
      if (!isDict(ctx)) continue;
      // Los ids de traza son hex aleatorio: el redactor podría confundirlos
      // con un DNI o un teléfono y romper el enlace error ↔ traza.
      for (const [k, v] of Object.entries(ctx)) {
        if (!TRACE_ID_KEYS.has(k)) ctx[k] = redactDeep(v);
      }
    }
  }
  if (event.tags) {
    for (const [k, v] of Object.entries(event.tags)) {
      if (typeof v === 'string') event.tags[k] = redact(v);
    }
  }

  if (typeof event.transaction === 'string') event.transaction = stripQuery(event.transaction);
  scrubSpans(event);

  return event;
}

export function beforeSend(event: ErrorEvent, _hint?: EventHint): ErrorEvent {
  return scrubEvent(event);
}

export function beforeSendTransaction(event: TransactionEvent, _hint?: EventHint): TransactionEvent {
  return scrubEvent(event);
}

/** `beforeSendSpan` en formato estático: el SDK lo aplica a cada span, raíz incluida. */
export const beforeSendSpan = withStaticSpan((span) => scrubSpan(span));

export function beforeBreadcrumb(crumb: Breadcrumb): Breadcrumb {
  return scrubBreadcrumb(crumb);
}

/**
 * Limpia el contexto de muestreo dinámico (DSC). Va en la cabecera de cada
 * envelope y en la cabecera `baggage` de las peticiones salientes, y su
 * `transaction` es el nombre de la transacción raíz, que puede llevar la query.
 * No pasa por `beforeSend*`: se limpia en el hook `createDsc`.
 */
export function scrubDsc(dsc: { transaction?: string }): void {
  if (typeof dsc.transaction === 'string') dsc.transaction = redact(stripQuery(dsc.transaction));
}

/** Registra los hooks de privacidad que no son opciones de `init`. Llamar tras `Sentry.init`. */
export function registerPrivacyHooks(client: SentryClient): void {
  client?.on('createDsc', scrubDsc);
}

export interface SentryEnv {
  dsn?: string;
  environment?: string;
}

/** Opciones comunes de `Sentry.init` para los tres runtimes. */
export function buildSentryOptions({ dsn, environment }: SentryEnv) {
  const env = environment || 'development';
  return {
    dsn,
    enabled: !!dsn,
    environment: env,
    sendDefaultPii: false,
    // En @sentry/core 11 `sendDefaultPii` ya no se lee: lo que recoge el SDK
    // (IP, cookies, cabeceras, cuerpos, query, variables locales) lo decide
    // `dataCollection`, cuyos valores por defecto lo recogen TODO. Se cierra
    // aquí en origen; `beforeSend*` sigue limpiando como segunda barrera.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: { request: { allow: [...ALLOWED_HEADERS] }, response: false },
      httpBodies: [],
      urlQueryParams: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
      mcp: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
    },
    tracesSampleRate: env === 'production' ? 0.1 : 0,
    // Sin esto (por defecto 'stream') el SDK no llama a beforeSendTransaction.
    traceLifecycle: 'static' as const,
    beforeSend,
    beforeSendTransaction,
    beforeSendSpan,
    beforeBreadcrumb,
  };
}
