
**2026-11-26 · T-0097 — `withSentryConfig` en v11 y memoria del build.** En `@sentry/nextjs` v11,
`withSentryConfig` se importa de `@sentry/nextjs/config` (desde el raíz da `is not a function` al cargar
`next.config.mjs`) y `disableLogger` pasa a ser `webpack.treeshake.removeDebugLogging`. Con Sentry, `next build`
de `apps/web` supera los 3 GB de RAM (OOM, exit 137, sin mensaje, en «Checking validity of types»): un builder
con 3 GB o menos ya no basta. Además, en v11 el `traceLifecycle` por defecto es `'stream'` y el SDK **ignora**
`beforeSendTransaction`: hay que fijar `traceLifecycle: 'static'` (o limpiar con `beforeSendSpan` en formato
streamed). Y `sendDefaultPii` ya no se lee: lo que recoge el SDK (IP, cookies, cabeceras, cuerpos, query,
variables locales) lo decide `dataCollection`, que por defecto lo recoge todo y hay que cerrar a mano. El DSC (`transaction` en la cabecera del envelope y en `baggage`) no pasa por `beforeSend*`: se limpia
en el hook `createDsc`. Los tests que llaman a los hooks a mano no detectan esto; hace falta un test con el SDK real.

## 2026-11-26 · T-0097 — Sentry 11 ignoraba la limpieza de privacidad por defecto

**Síntoma.** La primera iteración confiaba en `sendDefaultPii: false` y en `beforeSend`/`beforeSendTransaction` para cumplir la spec de privacidad. Los revisores encontraron un riesgo alto: el SDK seguía recogiendo IP, cookies, cabeceras y cuerpos en origen, y las transacciones no pasaban por `beforeSendTransaction`.

**Causa.** En `@sentry/nextjs` 11, `sendDefaultPii` ya no se lee. La recogida la gobierna `dataCollection`, cuyos valores por defecto lo recogen todo. Además, `traceLifecycle` por defecto es `'stream'`, que omite `beforeSendTransaction`.

**Arreglo.** `buildSentryOptions` fija `dataCollection` restrictivo, `traceLifecycle: 'static'`, `beforeSendSpan` y `createDsc` vía `registerPrivacyHooks`. Se añadieron pruebas contra el SDK real (`sentry.sdk.test.ts`, `sentry.sdk-defaults.test.ts`) que verifican que nada sensible sale. Ver la decisión del mismo día.

**Pendiente.** Los hallazgos de seguridad sobre `url.query` de migas `http` y `http.fragment` quedan como baja, y se anotan en el PR.

PR: https://github.com/estudiohz/razoncomun/pull/1
