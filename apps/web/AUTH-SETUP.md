# AUTH-SETUP.md — Identidad/Auth (rc-03), Ola 2

Guía operativa para Sergio (y para quien despliegue infra) de todo lo que
esta ola dejó **implementado pero pendiente de credenciales o de un
redeploy** que no están en mi alcance. Nada de esto bloquea el resto de la
construcción — los botones/flujos afectados quedan visibles y con mensajes
claros ("pronto"/501) hasta que se active cada pieza.

---

## 1. OAuth Google

1. https://console.cloud.google.com → crear proyecto (o reutilizar uno existente de Estudio Horizontal) → **APIs & Services → OAuth consent screen** → tipo "External", nombre "Razón Común", logo, dominio de soporte.
2. **Credentials → Create credentials → OAuth client ID** → tipo "Web application".
3. **Authorized redirect URIs** (añadir las dos, dev y prod):
   - `https://dev-api.razoncomun.com/auth/v1/callback`
   - `https://api.razoncomun.com/auth/v1/callback` (cuando exista, Ola 5)
4. Copiar `Client ID` y `Client secret`.
5. En `infra/docker-compose.supabase.yml`, servicio `auth`, descomentar y rellenar (vía variables de entorno del servicio en Dokploy, **nunca en el compose en claro**):
   ```yaml
   GOTRUE_EXTERNAL_GOOGLE_ENABLED: "true"
   GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
   GOTRUE_EXTERNAL_GOOGLE_SECRET: ${GOOGLE_SECRET}
   GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI: ${API_EXTERNAL_URL}/callback
   ```
   (ya están en el compose, comentadas — ver más abajo qué cambié yo).
6. Redeploy del servicio `auth` en Dokploy.
7. En `apps/web`, poner `NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED=true` en el entorno de esa build (Dokploy → variables del servicio web). Con eso los botones "Google" de `/registro` y `/entrar` se activan solos — el código ya está.

## 2. OAuth Facebook

1. https://developers.facebook.com/apps → crear app tipo "Consumer" → añadir producto **Facebook Login**.
2. **Facebook Login → Settings → Valid OAuth Redirect URIs**:
   - `https://dev-api.razoncomun.com/auth/v1/callback`
   - `https://api.razoncomun.com/auth/v1/callback`
3. Copiar `App ID` y `App secret` (Settings → Basic).
4. Añadir al compose (no estaban reservadas — las añadí yo, ver §5):
   ```yaml
   GOTRUE_EXTERNAL_FACEBOOK_ENABLED: "true"
   GOTRUE_EXTERNAL_FACEBOOK_CLIENT_ID: ${FACEBOOK_CLIENT_ID}
   GOTRUE_EXTERNAL_FACEBOOK_SECRET: ${FACEBOOK_SECRET}
   GOTRUE_EXTERNAL_FACEBOOK_REDIRECT_URI: ${API_EXTERNAL_URL}/callback
   ```
5. Redeploy + `NEXT_PUBLIC_OAUTH_FACEBOOK_ENABLED=true` en `apps/web`.

**No verificado en local**: sin credenciales no hay forma de probar el flujo real (el botón redirige a un provider que rechazaría el client_id vacío). El código de `/auth/callback` (route handler, PKCE `exchangeCodeForSession`) y la pasarela de consentimiento post-OAuth (`/registro/consentimiento`, obligatoria para quien entra por primera vez sin haber pasado por el checkbox de `/registro`) están implementados y compilan, pero su gate de verificación real queda pendiente de estas credenciales.

## 3. Stripe Identity (nivel `verified`)

1. Cuenta Stripe (test mode) → **Settings → Identity** → activar el producto.
2. **Developers → API keys** → copiar la clave secreta de test (`sk_test_...`).
3. **Developers → Webhooks → Add endpoint**:
   - URL: `https://dev.razoncomun.com/api/stripe/identity/webhook` (cuando la webapp esté desplegada; en local, usar `stripe listen --forward-to localhost:3000/api/stripe/identity/webhook`).
   - Eventos: `identity.verification_session.verified`, `identity.verification_session.requires_input`, `identity.verification_session.canceled`.
   - Copiar el **signing secret** (`whsec_...`).
4. Variables de entorno de `apps/web` (Dokploy, o `.env.local` para desarrollo):
   ```
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_IDENTITY_WEBHOOK_SECRET=whsec_...
   ```
5. Con eso, el botón "Verificar mi identidad" de `/perfil` (nivel `member`) crea sesiones reales y el webhook sube el nivel a `verified` de verdad.

**Cómo lo verifiqué sin claves reales**: simulé el webhook end-to-end contra mi propia ruta (`/api/stripe/identity/webhook`) generando una firma `Stripe-Signature` válida con el helper oficial del SDK (`Stripe.webhooks.generateTestHeaderString`, pura criptografía local — no llama a la red de Stripe) usando un `STRIPE_IDENTITY_WEBHOOK_SECRET` inventado en `.env.local`. Evidencia real (ver informe de cierre de ola): firma manipulada → 400; evento válido → 200 y `profiles.level` pasa a `verified`; mismo evento reenviado → `idempotente:true`, sin duplicar en `audit_log`; evento `requires_input` → 200 sin tocar el nivel. La CLI real de Stripe (`stripe trigger`) no la pude usar porque exige una cuenta Stripe autenticada, que no existe todavía en esta ola.

## 4. Plantillas de email (español + identidad de marca)

**Contexto**: el correo de confirmación que recibió Sergio salía en inglés y sin marca — son las plantillas por defecto de GoTrue. Las nuevas viven en:

```
apps/web/src/lib/auth/email-templates/gotrue/
  confirmation.html   (alta → verifyOtp type=signup)
  recovery.html       (reset contraseña → type=recovery)
  magic_link.html     (→ type=magiclink)
  email_change.html   (→ type=email_change)
  invite.html         (→ type=invite)
```

Generadas por `apps/web/scripts/email-templates.mjs generar` (fuente única de la copia y el HTML — no editar los `.html` a mano, editar el script y regenerar). Usan variables Go template de GoTrue (`{{ .SiteURL }}`, `{{ .Token }}`, `{{ .TokenHash }}`) y enlazan **directamente a nuestra app** (`{{ .SiteURL }}/auth/confirm?token_hash=...&type=...`), no al `/auth/v1/verify` propio de GoTrue — así el flujo pasa por `apps/web/src/app/auth/confirm/route.ts`, que ya está implementado y probado.

**Diseño**: tablas + estilos inline (Outlook-safe), max 600px, `meta name="color-scheme" content="light"` + fallback `@media (prefers-color-scheme: dark)`, código OTP de 6 dígitos siempre visible además del botón, texto plano alternativo (lo genera el mismo script para el envío de prueba; GoTrue en sí no soporta adjuntar una parte `text/plain` distinta al enviar por SMTP — solo puede mandar el HTML que le demos. Si se quiere multipart real habría que sustituir el mailer de GoTrue por un envío propio vía n8n/Edge Function, fuera de alcance de esta ola. Lo dejo anotado como límite conocido, no resuelto). Colores: texto en azul tinta `#1B3D9C` (contraste alto sobre blanco), el teal solo como banda decorativa de cabecera con el logo — nunca portador de texto (arregla, dentro del correo, la deuda de contraste C-06 sin tocar la web).

**Logo**: `https://dev-api.razoncomun.com/storage/v1/object/public/marca/logo-rc-blanco.png` (blanco, transparente, 240×72 mostrados). Constante única en `LOGO_BLANCO_URL` dentro de `email-templates.mjs` — **⚠️ deuda anotada para el corte de Ola 5**: es la URL de `dev-api`; hay que subir el logo también al bucket `marca` de producción (`api.razoncomun.com`) y cambiar solo esa constante, o todos los correos ya enviados (no hay afiliados reales todavía, así que no es urgente) quedarían con la imagen rota.

### Cómo activarlas en GoTrue (pendiente de infra — no lo hice yo)

Self-hosted GoTrue puede leer cada plantilla desde una URL que él mismo
descarga al enviar. Pasos:

1. Crear un bucket público en Supabase Storage para plantillas (el bucket `marca` que ya existe solo admite `image/*`, hace falta uno nuevo, p.ej. `email-templates`, con `text/html` permitido) y subir los 5 `.html` de `gotrue/`. **No lo hice yo**: crear buckets nuevos es una acción de infraestructura persistente y compartida — la dejo para quien tenga las riendas de Dokploy/Storage, con la receta exacta aquí.
2. En `infra/docker-compose.supabase.yml`, servicio `auth`, añadir:
   ```yaml
   GOTRUE_MAILER_TEMPLATES_CONFIRMATION: "https://dev-api.razoncomun.com/storage/v1/object/public/email-templates/confirmation.html"
   GOTRUE_MAILER_TEMPLATES_RECOVERY: "https://dev-api.razoncomun.com/storage/v1/object/public/email-templates/recovery.html"
   GOTRUE_MAILER_TEMPLATES_MAGIC_LINK: "https://dev-api.razoncomun.com/storage/v1/object/public/email-templates/magic_link.html"
   GOTRUE_MAILER_TEMPLATES_EMAIL_CHANGE: "https://dev-api.razoncomun.com/storage/v1/object/public/email-templates/email_change.html"
   GOTRUE_MAILER_TEMPLATES_INVITE: "https://dev-api.razoncomun.com/storage/v1/object/public/email-templates/invite.html"
   GOTRUE_MAILER_SUBJECTS_CONFIRMATION: "Confirma tu email en Razón Común"
   GOTRUE_MAILER_SUBJECTS_RECOVERY: "Recupera el acceso a tu cuenta"
   GOTRUE_MAILER_SUBJECTS_MAGIC_LINK: "Tu enlace de acceso a Razón Común"
   GOTRUE_MAILER_SUBJECTS_EMAIL_CHANGE: "Confirma tu nuevo email"
   GOTRUE_MAILER_SUBJECTS_INVITE: "Te han invitado a Razón Común"
   ```
3. Redeploy del servicio `auth`.

**Cómo lo verifiqué sin poder redesplegar infra**: no pude hacer que GoTrue mande el HTML nuevo de verdad (eso exige el redeploy de arriba, fuera de mi alcance/herramientas en esta sesión). En su lugar mandé **correos reales** con el contenido exacto de estas plantillas directamente por el mismo SMTP de Brevo (mismas credenciales que usa GoTrue) a `estudiohorizontal@gmail.com` con `apps/web/scripts/email-templates.mjs enviar <tipo> <destino>` — 5 envíos reales, los 5 con `250 2.0.0 OK` de Brevo (ver informe de cierre de ola para los Message-ID). Esto prueba el renderizado real en una bandeja de Gmail (incluida la imagen del logo, que sí carga desde Storage) pero **no** prueba el pipeline de GoTrue en sí — eso solo se puede verificar tras el redeploy de infra.

## 5. Custom claim `level` en el JWT — mejora de rendimiento, NO aplicada

`apps/web/src/lib/auth/sql/0016_auth_claims_and_mfa_proposal.sql` propone un
"Custom Access Token Hook" de Supabase que metería `level`, `is_admin`,
`is_editor`, `requires_mfa` como claims del JWT. **No lo apliqué contra la
base de datos** (el esquema es propiedad de rc-02-datos) — los guards de
`apps/web/src/lib/auth/niveles.ts` funcionan hoy sin él, consultando
`profiles`/`positions` directamente y llamando a `is_admin()`/`is_editor()`
por RPC (ya expuestas por PostgREST, no hace falta ningún cambio para eso).
Esta migración solo ahorraría esas 2-3 consultas por navegación. Si
rc-02/el arquitecto la adopta, además hay que añadir en el compose:
```yaml
GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_ENABLED: "true"
GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_URI: "pg-functions://postgres/public/custom_access_token_hook"
```

## 6. Qué cambié yo en `infra/docker-compose.supabase.yml`

El compose ya reservaba las variables de Google comentadas y decía
explícitamente "rc-03-auth descomenta y configura en Ola 2". Sin
credenciales todavía, dejé:
- Las variables de Google **comentadas tal cual estaban** (no las activo sin credenciales reales — activarlas con `client_id` vacío rompería el arranque de GoTrue).
- Añadidas (comentadas igual) las de Facebook, que no existían.
- Añadido un bloque comentado con las variables del hook de claims (§5) y de las plantillas de email (§4), con instrucciones inline, para que quien tenga acceso a Dokploy solo tenga que copiar/pegar y rellenar.
- **No toqué** `GOTRUE_MFA_TOTP_*` (ya vienen activadas por rc-01, correcto) ni ningún otro valor existente.

## 7. Variables de entorno que necesita `apps/web` en Dokploy (además de las de Supabase que ya tiene rc-01)

```
NEXT_PUBLIC_SITE_URL=https://dev.razoncomun.com   # (o https://razoncomun.com en Ola 5)
STRIPE_SECRET_KEY=                                 # §3
STRIPE_IDENTITY_WEBHOOK_SECRET=                    # §3
NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED=false             # true cuando esté §1
NEXT_PUBLIC_OAUTH_FACEBOOK_ENABLED=false           # true cuando esté §2
```
