
**2026-11-26 · T-0097 — Sentry en apps/web sin datos personales.** Se integra `@sentry/nextjs` v11 en los tres
runtimes con una configuración única en `apps/web/sentry.common.ts` (`beforeSend`/`beforeSendTransaction`/
`beforeSendSpan`/`beforeBreadcrumb`, más el hook `createDsc`) que borra usuario, cookies, cuerpo, query strings, variables de los frames y cabeceras
fuera de la lista blanca (`user-agent`, `content-type`, `accept-language`), y redacta emails, DNI/NIE/NIF,
IBAN, teléfonos, JWT y claves. Prohibidos Session Replay, User Feedback, profiling, la identificación de usuario
y la ruta túnel. Sin DSN queda deshabilitado. Las `NEXT_PUBLIC_SENTRY_*` van como build args en Dokploy.
Detalle en `apps/web/SENTRY.md`.

## 2026-11-26 · T-0097 — Sentry en apps/web: privacidad en origen y trazas en modo estático

**Decisión.** Sentry (`@sentry/nextjs` 11.x) se configura en los tres runtimes con `buildSentryOptions` (`apps/web/sentry.common.ts`). Tres reglas:

1. **`dataCollection` cierra en origen** lo que el SDK recoge por defecto (usuario, cookies, cabeceras fuera de la lista blanca, cuerpos, query strings, variables locales de frames, GraphQL/genAI/MCP, consultas de BD). `beforeSend*` queda como segunda barrera.
2. **`traceLifecycle: 'static'`**, porque en el modo por defecto (`'stream'`) el SDK ignora `beforeSendTransaction` y las transacciones saldrían sin limpiar. En modo estático se usa también `beforeSendSpan`.
3. **`createDsc`** se limpia con `registerPrivacyHooks(Sentry.getClient())`, porque la cabecera DSC (y el `baggage` saliente) no pasa por los `beforeSend*`.

**Motivo.** La web trata opinión política y afiliación (RGPD Art. 9). En `@sentry/nextjs` 11 `sendDefaultPii` ya no controla qué datos se recogen: lo decide `dataCollection`. Confiar solo en `sendDefaultPii: false` dejaba IP, cookies y cabeceras en origen.

**Desviación de la spec.** `sentry.common.ts` importa en tiempo de ejecución `withStaticSpan` (además de tipos), porque `beforeSendSpan` lo necesita. Por eso la lógica pura ya no es testeable sin el SDK, y se añadieron `sentry.sdk.test.ts` y `sentry.sdk-defaults.test.ts` (SDK real, transporte en memoria).

PR: https://github.com/estudiohz/razoncomun/pull/1
