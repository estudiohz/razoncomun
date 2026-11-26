# SENTRY.md — Monitorización de errores con filtrado RGPD (T-0097)

La web trata opinión política y afiliación (**categoría especial, RGPD Art. 9**). Sentry está
integrado para ver errores, pero **ningún dato personal sale hacia Sentry**. Toda la limpieza vive
en `sentry.common.ts` y la comparten los tres runtimes (Node, edge y navegador).

**Sin DSN no se envía nada**: `enabled: !!dsn`. En local, tests y CI Sentry no hace nada y el build
funciona igual.

## Archivos

| Archivo | Qué hace |
|---|---|
| `sentry.common.ts` | Redactor, `beforeSend`, `beforeSendTransaction`, `beforeSendSpan`, `beforeBreadcrumb`, `buildSentryOptions` y `registerPrivacyHooks` (DSC) |
| `sentry.server.config.ts` / `sentry.edge.config.ts` | `Sentry.init` en Node y edge |
| `src/instrumentation.ts` | `register()` carga la config del runtime; `onRequestError` captura errores de servidor |
| `src/instrumentation-client.ts` | `Sentry.init` en el navegador |
| `src/app/global-error.tsx` | Error boundary raíz: `captureException` y página "Algo ha ido mal" (sin mostrar el mensaje del error) |
| `next.config.mjs` | `withSentryConfig` (de `@sentry/nextjs/config` en v11) |

## Variables (Dokploy → servicio web)

| Variable | Cuándo | Para qué |
|---|---|---|
| `SENTRY_DSN` | runtime | DSN de servidor/edge (si falta, usa `NEXT_PUBLIC_SENTRY_DSN`) |
| `SENTRY_ENVIRONMENT` | runtime | `production` / `development` (por defecto `development`) |
| `NEXT_PUBLIC_SENTRY_DSN` | **build arg** | DSN del navegador |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | **build arg** | entorno del navegador |
| `SENTRY_AUTH_TOKEN` | build arg, opcional, **secreto** | subir source maps; sin él no se generan ni suben |
| `SENTRY_ORG` / `SENTRY_PROJECT` | build arg, opcional | destino de los source maps |

Las `NEXT_PUBLIC_*` las **incrusta Next al compilar**: en Dokploy van como *Build Arguments*, no
solo como variables de entorno; si no, el bundle del navegador sale sin DSN. El `Dockerfile` las
declara como `ARG` vacíos en el stage `builder`, así que sin ellas el build no falla.
`SENTRY_AUTH_TOKEN` solo existe en el stage `builder` y nunca llega a la imagen final.

Con `production`, `tracesSampleRate` es 0.1; en cualquier otro entorno, 0.

**`traceLifecycle: 'static'` es obligatorio.** En `@sentry/nextjs` 11 el modo por defecto es
`'stream'` (los spans se envían sueltos) y en ese modo el SDK **ignora `beforeSendTransaction`**:
las trazas saldrían sin limpiar. En modo estático los spans van dentro de la transacción, que pasa
por `beforeSendTransaction`, y cada span por `beforeSendSpan` (envuelto con `withStaticSpan`).
Además, cada `Sentry.init` va seguido de `registerPrivacyHooks(Sentry.getClient())`, que limpia el
contexto de muestreo (DSC: cabecera del envelope y `baggage` saliente), donde el nombre de la
transacción raíz viaja sin pasar por `beforeSend*`.

## Qué se filtra (en todos los eventos y transacciones)

- `user` entero (id, email, IP) y `contexts.user`; `sendDefaultPii: false`.
- `request.cookies`, `request.data` (cuerpo), `request.query_string`, `request.env` y `server_name`.
- Cabeceras: solo se conservan `user-agent`, `content-type` y `accept-language`.
- Query string y fragmento de `request.url`, del nombre de la transacción, de los spans y de las
  migas de navegación (`from`/`to`) y de red (`fetch`/`xhr`, que además se quedan solo con
  `method`, `status_code` y `url`).
- Variables locales de los frames de la traza (`frames[].vars`).
- Redacción a `[redactado]` en mensajes, valores de excepción, migas, `extra`, `contexts` y `tags`:
  emails, DNI, NIE, NIF/CIF, IBAN, teléfonos españoles, JWT (`eyJ…`), claves `sk_`/`pk_`/`rk_`/`whsec_`
  y `Bearer <token>`.

## Lo que NO se usa (y no debe añadirse)

- **Session Replay** y **User Feedback**: graban o recogen contenido de la pantalla y del usuario.
- **Profiling**.
- **Identificar al usuario** en Sentry (la llamada del SDK para fijar el usuario está prohibida):
  rompería el anonimato que garantiza `beforeSend`. Un test (`sentry.common.test.ts`) falla si
  aparece en el código.
- Ruta túnel: no hace falta, no hay CSP `connect-src` global (la única CSP es local al HTML del
  embed de `/api/cerebro/embed/[id]`).

## Cookies y consentimiento

Sin Replay, el SDK no escribe cookies ni `localStorage`, así que no depende del aviso de cookies
(`AvisoCookies`).

## Tests

`npm test` incluye `sentry.sdk.test.ts` (el SDK real con transporte en memoria: comprueba que
lo que se envía de verdad sale limpio) y `sentry.common.test.ts`: limpieza de eventos, transacciones y migas, redactor,
opciones sin DSN, y comprobaciones estáticas del cableado (instrumentation, `next.config.mjs`,
`Dockerfile`, `global-error.tsx`).
