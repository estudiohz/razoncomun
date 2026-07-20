# RC-Brain — Servicio persistente (Ola 3, rc-08-brain)

> Salida 2 de rc-08-brain (`docs/tecnico/plan-lanzamiento.md`): el chat
> "Pregunta a Razón Común", el canal interno de Discord y el entrevistador +
> clasificador de Opina. La ingesta (Ola 1) vive en `lib/brain/ingest/` y no
> se toca aquí.

**Estado: código completo, desplegado localmente y verificado end-to-end
contra la BD real; PENDIENTE de desplegarse en Dokploy (requiere el merge de
`feat/brain` a `main`) y de dos secretos de Sergio (`ANTHROPIC_API_KEY`,
`BRAIN_INTERNAL_TOKEN`).** Ver el informe final de esta ola para el detalle
completo de qué se verificó y cómo.

## Qué hace

Un único servicio HTTP (`src/server.mjs`, Node nativo, cero dependencias)
que concentra:

- **RAG** (`retrieval.mjs`): recuperación por similitud coseno contra
  `brain_documents`, con el filtro público/interno como única fuente de
  verdad (I3 — ver comentario en el propio archivo).
- **Constitución** (`constitution.mjs`): los prompts de sistema que fuerzan
  declarar IA, citar fuentes, decir "no lo sé" fuera de corpus y tratar el
  texto del usuario como dato nunca como instrucción.
- **Guardrail anti-inyección** (`injectionGuard.mjs`): capa determinista
  (regex), corre ANTES de gastar una llamada a Ollama/Anthropic.
- **Generación** (`llm.mjs` + `providers/`): capa multiproveedor (D-016) --
  Anthropic, OpenAI o Google, uno solo activo a la vez, elegido desde el panel
  admin (`ai_provider_credentials`, propiedad de rc-02) o por variable de
  entorno como fallback. Solo para redactar/clasificar — nunca para
  embeddings (decisión cerrada, `revision-seguridad.md`).
- **Vigilancia de neutralidad** (`credentialStore.mjs` + `providerWatcher.mjs`):
  tras un cambio de proveedor, corre la suite de neutralidad automáticamente
  y revierte solo (`ai_credentials_revert()`) si el resultado cae por debajo
  del 95% -- ver sección D-016 más abajo.
- **Rate limit** (`rateLimit.mjs`): token bucket en memoria, por IP y sesión.
- **Logging** (`audit.mjs`): cada turno completo va a `audit_log` (de rc-02),
  con la IP hasheada, nunca en claro.
- **Opina** (`opinaFlow.mjs` + `opinions.mjs`): entrevistador de 3 pasos
  (apertura → máx. 1-2 repreguntas → cierre) y el clasificador estructurado y
  validado hacia la tabla `opinions`.
- **Suite de neutralidad** (`neutralitySuite.mjs`): 16 pares (izquierda/derecha
  del mismo argumento), escribe en `ai_evals` (tabla pública de transparencia).

## Endpoints

| Ruta | Auth | Canal | Corpus |
|---|---|---|---|
| `GET /health` | ninguna | — | — |
| `POST /chat` | ninguna (rate-limited) | web pública | **SOLO `visibility='public'`** |
| `POST /chat-team` | `Bearer BRAIN_INTERNAL_TOKEN` | Discord del equipo | completo (público + interno) |
| `POST /opina/turn` | ninguna (rate-limited) | web/Discord/Telegram | — |
| `POST /classify-opinion` | `Bearer BRAIN_INTERNAL_TOKEN` | n8n/Discord (uso interno) | — |
| `POST /neutrality-suite/run` | `Bearer BRAIN_INTERNAL_TOKEN` | manual/n8n | — |
| `POST /provider/verify` | `Bearer BRAIN_INTERNAL_TOKEN` | panel admin/manual (D-016) | — |

Sin `BRAIN_INTERNAL_TOKEN` configurado, las rutas internas devuelven **501**
(fail-closed) — nunca sirven "vacío" como si fuera 200 legítimo.

## Verificación hecha en esta máquina (sin Ollama, sin ANTHROPIC_API_KEY)

Ver `scripts/gate-brain.mjs` (ejecutable, 27/27 comprobaciones al cierre de
esta ola) y el informe final para el detalle línea a línea. Resumen:

- **Guardrail anti-inyección**: 100% real, sin mocks — es código
  determinista. 6/6 intentos de inyección bloqueados, 0/2 falsos positivos
  sobre preguntas legítimas.
- **Aislamiento público/interno (I3)**: 100% real contra el Supabase de
  producción (112 chunks reales: 81 `public`, 31 `internal`). Un barrido
  completo con `visibility:'public'` y un texto de ataque devuelve las 81
  filas públicas y CERO internas; el canal `visibility:null` sí ve las 31
  internas; pedir `visibility:'internal'` explícito lanza un error (API
  cerrada a ese valor).
  - Probado también sobre HTTP real (servidor arrancado en `:8799`
    localmente): `/chat` con un intento de inyección responde el mensaje fijo
    de rechazo con `sources:[]`; `/chat-team` con un token correcto sí
    devuelve fuentes marcadas `visibility:"internal"`.
- **Rate limit**: probado por HTTP con límites bajados a propósito (2/hora) —
  3ª petición devuelve `429` con `retryAfterMs`.
- **Preguntas de control (5) + fuera de corpus (3)**: la tubería SQL corre
  sin error contra la BD real, pero con `EMBEDDINGS_PROVIDER=mock` (Ollama no
  es alcanzable desde esta máquina) los resultados **no son semánticamente
  evaluables** — ya se verificaron semánticamente contra Ollama real en Ola 1
  (`rc-brain-control`, confirmado `exit 0` vía la API de Dokploy), pero no
  pude recuperar el stdout literal de ese contenedor para citar el
  "Resultado: X/5" exacto (ver informe).
- **Suite de neutralidad**: el comparador (`classificationsEquivalent`) y los
  16 pares se probaron estructuralmente, **sin llamar a Anthropic y sin
  escribir en `ai_evals`** (para no ensuciar esa tabla pública con datos de
  mock). El % real (`≥95%` pedido) exige `ANTHROPIC_API_KEY` — pendiente de
  Sergio.
- **Opina**: apertura determinista probada; primer turno sustantivo (repregunta)
  y cierre (clasificación) probados por HTTP con `ANTHROPIC_API_KEY` ausente
  → degradan con un mensaje claro en vez de un error confuso (ver
  `AnthropicNotConfiguredError` en `server.mjs`).

## Capa multiproveedor y neutralidad (D-016)

`llm.mjs` es el único punto de entrada de generación/clasificación para el
resto del servicio -- RAG, constitución, guardrail y rate limit no saben ni
les importa qué proveedor hay detrás. Debajo de `llm.mjs`:

- `credentialStore.mjs` resuelve el proveedor activo: lee
  `ai_credentials_get_active()` (tabla `ai_provider_credentials`, propiedad
  de rc-02) usando `AI_CREDENTIALS_MASTER_KEY` de entorno, con caché de
  `AI_CREDENTIALS_CACHE_TTL_MS` (20s por defecto) -- así un cambio de
  proveedor desde el panel admin surte efecto sin reiniciar el contenedor.
  Sin clave maestra o sin fila activa, cae al fallback `ANTHROPIC_API_KEY` de
  siempre (fail-soft).
- `providers/{anthropic,openai,google}.mjs` son los tres adaptadores
  (interfaz común `chat({apiKey, model, system, messages, ...}) -> texto`).
  `providers/index.mjs` es el registro.
- `providerWatcher.mjs` es el enganche de neutralidad: detecta cuándo cambió
  la credencial activa (vigilancia periódica cada
  `AI_PROVIDER_WATCH_INTERVAL_MS`, o a demanda vía `POST /provider/verify`),
  corre `neutralitySuite.runNeutralitySuite()`, y si el resultado cae por
  debajo de `AI_NEUTRALITY_MIN_PCT` (95% por defecto) llama a
  `ai_credentials_revert()` automáticamente -- sin intervención humana.

Verificación end-to-end del mecanismo de reversión (contra la BD real, con
autolimpieza -- ver cabecera del propio script para el detalle paso a paso):

```bash
node scripts/verify-provider-revert.mjs
  # o: RC_BRAIN_GATE_ENV=/ruta/a/un/.env-con-SUPABASE_PUBLIC_URL-y-SERVICE_ROLE_KEY node scripts/verify-provider-revert.mjs
```

Activa dos credenciales de prueba con claves dummy (inválidas a propósito),
deja que `providerWatcher` detecte el "cambio de proveedor" por el mismo
camino que usaría la vigilancia periódica real, corre la suite de
neutralidad de verdad (32-64 llamadas HTTP reales a Anthropic, todas
rechazadas por autenticación -> 0% de pares equivalentes), confirma que
revierte a la credencial anterior, y borra sus propios restos al final. Ver
el informe final de esta ola para el resultado exacto de la última corrida.

## Cómo correr el gate localmente

```bash
node scripts/gate-brain.mjs \
  # o: RC_BRAIN_GATE_ENV=/ruta/a/un/.env-con-SUPABASE_PUBLIC_URL-y-SERVICE_ROLE_KEY node scripts/gate-brain.mjs
```

## Variables de entorno

Ver `.env.example`. Pendientes de Sergio: `ANTHROPIC_API_KEY`,
`BRAIN_INTERNAL_TOKEN` (generar con `openssl rand -hex 32`),
`BRAIN_IP_HASH_SALT`.

## Despliegue

Ver `docker-compose.brain-service.yml` (comentario final del archivo,
instrucciones paso a paso) — **no desplegado todavía**: Dokploy despliega
desde la rama `main`, y este código vive en `feat/brain` hasta que el
orquestador haga el merge de esta ola.
