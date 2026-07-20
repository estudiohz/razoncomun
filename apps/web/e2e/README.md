# Suite E2E de navegador — Razón Común

Capa de **navegador real** (Playwright + Chromium) que ejercita los flujos de
usuario que Sergio recorre a mano: los que un test de solo-`fetch` no ve porque
el fallo vive en el DOM renderizado, el JS de cliente o la geometría del layout.

Complementa —no sustituye— a `scripts/smoke/` (Python: base + PostgREST + RLS).
Reparto: la suite de smoke prueba datos y RLS en la capa de su afirmación; esta
suite prueba lo que **pasa en la pantalla**.

> El bug del `<select>` del perfil (tres capas, la última solo visible en un
> navegador de verdad) es exactamente lo que esta suite caza sola.

## Cómo se corre

Desde `apps/web/` (Playwright vive aquí por sus dependencias):

```bash
# suite completa contra dev (default: https://dev.razoncomun.com)
npx playwright test --config e2e/playwright.config.ts

# apuntar a otro entorno (local, staging, prod limpia de la Ola 5)
E2E_BASE_URL=http://localhost:3000 npx playwright test --config e2e/playwright.config.ts

# subconjuntos con el --grep nativo (las specs llevan etiquetas @…)
npx playwright test --config e2e/playwright.config.ts --grep @publico
npx playwright test --config e2e/playwright.config.ts --grep @visual
npx playwright test --config e2e/playwright.config.ts --grep-invert @auth

# un solo proyecto (viewport)
npx playwright test --config e2e/playwright.config.ts --project=mobile
```

Reporte HTML tras una corrida: `npx playwright show-report`.

### Variables de entorno (CERO secretos en el repo)

| Variable | Obligatoria | Para qué |
|---|---|---|
| `E2E_BASE_URL` | no (default dev) | URL a probar |
| `E2E_STORAGE_STATE` | no | ruta a un `storageState.json` de sesión ya creada |
| `E2E_EMAIL` / `E2E_PASSWORD` | no | credenciales para que `auth.setup.ts` genere la sesión |
| `E2E_AUTH_ROLE` | no | `admin` si la sesión provista es de un admin (ajusta el caso admin) |

## Proyectos (viewports)

- **desktop** — 1440×900 (Chromium escritorio).
- **mobile** — 390×844 (Chromium móvil: `isMobile` + touch).
- **setup** — genera la sesión de test; se salta si no hay credenciales.

## Qué cubre cada spec

| Spec | Etiquetas | Qué verifica |
|---|---|---|
| `home.spec.ts` | `@publico` | Home 200, `h1` de marca, nav + footer, título con la marca, logo→`/`. |
| `blog.spec.ts` | `@publico` | `/blog` 200, `h1` "Análisis por departamentos", al menos una ficha enlazada. |
| `entrada.spec.ts` | `@publico` | **Layout nuevo D-022** por geometría real: etiqueta a la izquierda y antes del título; orden título→imagen→**metadatos bajo la imagen**. |
| `auth.spec.ts` | `@auth @publico` | `/entrar` renderiza el modo enlace mágico; `/auth/confirm` con token inválido redirige al **origen público** (regresión del bug `0.0.0.0`) con su mensaje de error. |
| `afiliate.spec.ts` | `@publico` / `@auth` | Anónimo: escalera de 3 niveles + CTA a `/entrar?next=/afiliate`, y **NO** el formulario NIF/IBAN (regresión de la fuga). Con sesión: los dos planes (Mensual/Anual). |
| `admin.spec.ts` | `@auth` | Sin sesión: `/admin` y `/admin/*` redirigen a `/entrar`. Con sesión no-admin: el guard saca del panel. |
| `perfil.spec.ts` | `@publico` / `@auth` | Sin sesión: `/perfil` redirige (control). Con sesión: guardar nombre+provincia muestra "Guardado" y el `<select>` **conserva el valor** (regresión de 3 capas), incluso tras recargar. |
| `menu-movil.spec.ts` | `@movil` | A 390 px el burger abre el overlay fullscreen con enlaces + redes; cierra con Escape. Se salta en escritorio y —de forma resiliente— si rc-04 no estuviera desplegado. |
| `visual.spec.ts` | `@visual` | Regresión visual de home, blog y entrada (desktop + móvil). |

## Qué queda `test.skip` y por qué (skips honestos)

Nunca hay un test que finge pasar. Lo no-alcanzable se deja **escrito y saltado**
con motivo, listo para cuando exista la pieza que falta:

- **Perfil con sesión**, **Afiliación con sesión**, **Admin no-admin**: requieren
  una **sesión de navegador**. Sin `E2E_STORAGE_STATE` (o credenciales para
  `auth.setup.ts`), se saltan. Ver más abajo cómo habilitarlos.
- **Viaje completo del enlace mágico**: requiere un **buzón de prueba** para leer
  el token del correo (Mailpit/Inbucket del stack Supabase). No alcanzable sin él.
- **Admin CON 2FA (aal2)**: requiere el **secreto TOTP** para generar un código
  válido por sesión, o un `storageState` ya elevado a aal2. No forjable de forma
  determinista desde el navegador.
- **Menú móvil**: se salta en el proyecto `desktop` (solo existe <960 px) y, como
  red de seguridad, si el burger no estuviera en el HTML del entorno bajo prueba.

## Sesión de test (flujos autenticados)

Dos vías, ninguna deja secretos en el repo:

1. **Generarla con credenciales** (usa el login por contraseña real):
   ```bash
   E2E_EMAIL="usuario@ejemplo.com" E2E_PASSWORD="…" \
     npx playwright test --config e2e/playwright.config.ts --project=setup
   ```
   Guarda la sesión en `e2e/.auth/user.json` (carpeta **ignorada por git** —
   contiene tokens de acceso reales). Después, `npx playwright test` ya no salta
   los flujos autenticados.

2. **Reutilizar un `storageState` existente**:
   ```bash
   E2E_STORAGE_STATE=/ruta/segura/user.json npx playwright test --config e2e/playwright.config.ts
   ```

Si la sesión es de un admin, añade `E2E_AUTH_ROLE=admin` para que el caso
"no-admin" no se ejecute contra ella.

## Regresión visual — baselines

- Los baselines viven en `specs/visual.spec.ts-snapshots/` y **se versionan**
  (un cambio de CSS que rompa el boceto sale en rojo sin que nadie lo mire).
- Están **enmascarados** los elementos genuinamente dinámicos: el vídeo del hero,
  el rotatorio de slogans y las imágenes remotas (portadas de artículo). El
  **layout** sí se compara; el contenido cambiante, no.
- Los ficheros llevan sufijo de plataforma (`…-win32.png`): se generaron en
  Windows contra `dev`. En otra plataforma (CI Linux) hay que **regenerarlos** una
  vez en esa plataforma.
- Regenerar tras un cambio de diseño **intencionado**:
  ```bash
  npx playwright test --config e2e/playwright.config.ts --grep @visual --update-snapshots
  ```

## Notas de estabilidad

- El sitio es **remoto**: la config activa un reintento (`retries: 1`) para
  absorber jitter de red. El gate real se validó con `--retries=0`.
- `entrada.spec.ts` espera a `load` + a que la imagen destacada termine de
  cargar antes de medir geometría (medir antes daba cajas a 0). Los metadatos se
  anclan al `<time>` de la cabecera, no al texto "min de lectura" (que también
  aparece en los `<script>` de datos RSC de Next → falso positivo a 0,0).
