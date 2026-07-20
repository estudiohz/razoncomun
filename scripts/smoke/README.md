# Suite de smoke — Razón Común

Suite única y **reejecutable** que codifica los invariantes críticos que fuimos
verificando de forma dispersa durante la construcción (Olas 0-4). Una sola
invocación devuelve **verde/rojo + resumen + código de salida** (`0` = todo ok,
`1` = algún invariante roto), para engancharla a un post-deploy o correrla a mano.

Consolida piezas que estaban tiradas por el scratchpad y el repo:
`qa_rls_matrix.py`, `qa_write_attacks.py`, `qa_d017_bypass.py`, `scan_total.py`,
`verify_rls.py`, `verify_brain.py`, y referencia los verificadores Node
(`apps/web/scripts/verificacion-*.mjs`, `scripts/gate-brain.mjs`,
`scripts/verify-provider-revert.mjs`) vía el bridge `--node`.

## Principio de diseño

- **Se verifica en la capa de la afirmación.** "La RLS/el trigger bloquea" se
  demuestra leyendo el **estado persistido** antes y después del ataque (con
  `service_role`), no confiando en el código HTTP. Un `PATCH` puede devolver
  `204` y aun así no haber cambiado nada por un trigger: lo que cuenta es el dato.
- **Fixtures efímeros y autolimpieza.** Cada corrida crea sus propios usuarios y
  votación (tag único, emails `smoke-<tag>-*@smoke.invalid`) y los borra al final.
  No depende de seeds concretos. El runner verifica que los **conteos de fila son
  idénticos antes/después** (salvo `audit_log`, que es append-only).
- **Control positivo.** Además de los "no puede", se comprueba que el miembro
  antiguo verificado **sí** vota vinculante. Si todo fuera deny-all, la suite
  estaría mintiendo en verde.

## Cómo se corre

Parametrizada **100% por entorno**. Nada de claves en el repo (público).

```bash
# opción A: exportar variables
export PYTHONIOENCODING=utf-8          # obligatorio (bug D-009)
export RC_BASE_URL=https://dev-api.razoncomun.com
export RC_ANON_KEY=...
export RC_SERVICE_ROLE_KEY=...
export RC_JWT_SECRET=...
python run.py

# opción B: apuntar a un fichero KEY=VALUE (NUNCA commitear ese fichero)
export PYTHONIOENCODING=utf-8
export RC_SMOKE_ENV_FILE=/ruta/a/supabase.env
python run.py
```

Para la **Ola 5 (producción limpia)** se corre igual, cambiando solo el entorno
apuntado (o `RC_WEB_URL`). El mismo comando sirve para dev y para prod.

### Variables

| Variable | Obligatoria | Para qué |
|---|---|---|
| `RC_BASE_URL` (o `SUPABASE_PUBLIC_URL`) | sí | URL de Supabase (Kong) |
| `RC_ANON_KEY` (o `ANON_KEY`) | sí | apikey de consumidor Kong |
| `RC_SERVICE_ROLE_KEY` (o `SERVICE_ROLE_KEY`) | sí | línea base / setup / teardown |
| `RC_JWT_SECRET` (o `JWT_SECRET`) | sí | firmar JWT de usuarios de prueba |
| `RC_WEB_URL` | no | activa checks de capa web (cabeceras, noindex, /chat) |
| `RC_STRIPE_WEBHOOK_SECRET` | no | idempotencia de webhook |
| `RC_SMOKE_ENV_FILE` | no | fichero KEY=VALUE a cargar en el entorno |

### Opciones

```bash
python run.py                 # suite completa
python run.py --only c1,rls   # subconjunto de bloques: encoding,rls,c1,brain,nif,stripe,deploy
python run.py --self-test     # DEMUESTRA el rojo: invierte C-1 a propósito -> exit 1
python run.py --node          # además invoca los verificadores Node (requieren app)
```

## Qué invariante cubre cada bloque

| Bloque | Invariante | Origen del bug |
|---|---|---|
| `encoding` | 0 mojibake (`chr(195)`, `chr(226)`, `U+FFFD`) en datos mutables **y** catálogos (`pg_description`, `pg_proc.prosrc`). `audit_log` histórico se audita aparte. | D-009 (recurrente) |
| `rls` | Aislamiento de lectura: anon no lee lo privado (brain, credenciales IA, NIF, members, notificaciones); registered solo lee su propio perfil. | Matriz RLS Ola 4 |
| `c1` | **C-1**: un member no verificado no puede escribir `identity_verified_at`/`member_since`/`level` (trigger `profiles_protect_level`). Incluye el bypass D-017 end-to-end. Escalada de privilegios, **sellado** de votación abierta (quorum/threshold/min_membership_days), elegibilidad de voto (censo verified + antigüedad), suplantación, peso ilegítimo, tax_identities sellado, `ai_provider_credentials` opaco incluso a admin. | C-1, D-017, I6 |
| `brain` | Aislamiento del cerebro: ningún JWT de usuario obtiene chunks (deny-all); admin no extrae los `internal`. `/chat` público → requiere despliegue. | Constitución del cerebro |
| `nif` | Formato de NIF inválido rechazado (constraint BD) + control positivo + aislamiento de `tax_identities`. | RGPD Art. 9 |
| `stripe` | Idempotencia del webhook (reenviar no duplica). Requiere despliegue. | rc-07 |
| `deploy` | Invariantes que exigen la app desplegada: 2FA en `/admin`, rechazo de webhook sin firma, prompt injection a chat/Opina, revert de proveedor IA, e2e, SEO, accesibilidad, cabeceras CSP/HSTS/X-Frame-Options, noindex de rutas privadas. `SKIP` con motivo si no hay `RC_WEB_URL`. | varios |

## Qué NO cubre sin despliegue

Ollama (embeddings) es inalcanzable fuera del VPS y la app Next.js no corre en la
máquina de QA, así que los invariantes de capa web se marcan **`SKIP` "requiere
despliegue"** y quedan listos, no forzados con mocks. Con la app desplegada:
`python run.py --node` dispara los verificadores Node dedicados; definir
`RC_WEB_URL` activa cabeceras/noindex/`/chat`.

## Hallazgo abierto conocido

En `dev`, `encoding` sale **rojo** por un hallazgo **real**: una fila histórica de
`audit_log.meta` (turno de chat de RC-Brain) tiene el `user_text` del usuario
corrompido a `U+FFFD` (`"¿Qué propone Razón Común para los autónomos?"` →
`"�Qu� propone Raz�n Com�n..."`). Es D-009 reapareciendo en la **ruta de logging
de la entrada del chat** (rc-08); el `answer_text` está intacto. `audit_log` es
append-only: la fila no se puede borrar, así que `dev` seguirá rojo en ese punto
hasta reset de BD, pero un entorno limpio (Ola 5) sale verde. Esto además sirve de
prueba viva de que la suite detecta mojibake real.

## Estructura

```
scripts/smoke/
  run.py            runner único (orquesta, snapshot de conteos, self-test, bridge node)
  lib/
    config.py       carga de entorno (cero claves hardcodeadas)
    http.py         clientes /pg/query (UTF-8), PostgREST, web
    jwt.py          firma HS256 estilo Supabase
    fixtures.py     usuarios/votación efímeros + setup/teardown
    report.py       verde/rojo + resumen + exit code
  checks/
    encoding.py     mojibake (datos + catálogos + audit_log)
    rls_matrix.py   aislamiento de lectura
    write_attacks.py  C-1, escalada, sellado, elegibilidad, tax, credenciales IA
    brain.py        aislamiento del cerebro
    nif.py          formato NIF + aislamiento tax_identities
    stripe_idem.py  idempotencia webhook (requiere despliegue)
    deploy_checks.py invariantes dependientes de la app desplegada
```
