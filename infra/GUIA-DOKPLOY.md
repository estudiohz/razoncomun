# 🛡️ Guía de Despliegue y Auditoría en Dokploy — infra/

> **Para quien lea esto sin haber estado en la sesión que lo escribió.** Este documento es la fuente de verdad de todo lo que vive (o debería vivir) en el VPS bajo Dokploy para Razón Común: qué se despliega, con qué comandos exactos, cómo se verifica que funciona, y cómo se reconstruye todo desde cero si hiciera falta. Escrito por `rc-01-infra` (Ola 0, 19/07/2026) **en modo preparación** (sin acceso a Dokploy/SSH en esa sesión — ver §9 para qué falta para pasar a "desplegado y verificado").
>
> Estado a fecha de escritura: **NADA de esto está desplegado todavía.** Todo lo de abajo son instrucciones a ejecutar, no un registro de hechos consumados. Cuando se despliegue de verdad, quien lo haga debe actualizar la sección "Estado actual" (§10) con fecha y evidencia.

---

## 0. Mapa de esta carpeta

```
infra/
├── docker-compose.supabase.yml   # Stack Supabase self-hosted (db, auth, rest, storage,
│                                  # imgproxy, realtime, meta, kong, studio)
├── docker-compose.ollama.yml     # Ollama + bge-m3 (embeddings del RC-Brain)
├── .env.example                  # Plantilla EXHAUSTIVA de variables — copiar a .env local,
│                                  # nunca commitear .env
├── supabase/
│   └── volumes/
│       ├── db/                   # Scripts SQL de inicialización del contenedor Postgres
│       │   ├── 00-extensions.sql #   ← el único que añade rc-01 (pgvector, pg_trgm)
│       │   ├── realtime.sql, webhooks.sql, roles.sql, jwt.sql,
│       │   └── _supabase.sql, logs.sql   (vendorizados de Supabase, sin modificar)
│       └── api/
│           ├── kong.yml          # Config declarativa del gateway (vendorizada, sin modificar)
│           └── kong-entrypoint.sh
├── backup/
│   ├── backup-pg-encrypted.sh    # Cron diario: pg_dump → gzip → cifrado age
│   └── restore-pg-encrypted.sh   # --dry-run (ensayo) y --real (incidente real)
└── GUIA-DOKPLOY.md               # este archivo

apps/web/Dockerfile               # Build de la webapp Next.js (propiedad de rc-01 dentro
                                   # de apps/web/ — el resto de esa carpeta es de rc-04-front)
```

---

## 1. De dónde sale el compose de Supabase y qué se le cambió

**No se escribió de memoria.** El 19/07/2026 se descargó directamente de la fuente oficial:
- `https://raw.githubusercontent.com/supabase/supabase/master/docker/docker-compose.yml`
- `https://raw.githubusercontent.com/supabase/supabase/master/docker/.env.example`
- `https://raw.githubusercontent.com/supabase/supabase/master/docker/volumes/db/*.sql`
- `https://raw.githubusercontent.com/supabase/supabase/master/docker/volumes/api/kong.yml` y `kong-entrypoint.sh`

En esa fecha la versión vendorizada usaba estas imágenes (anotado para poder comparar en una futura actualización): `supabase/studio:2026.07.07-sha-a6a04f2`, `kong:3.9.1`, `supabase/gotrue:v2.189.0`, `postgrest/postgrest:v14.12`, `supabase/realtime:v2.102.3`, `supabase/storage-api:v1.60.4`, `darthsim/imgproxy:v3.30.1`, `supabase/postgres-meta:v0.96.6`, `supabase/postgres:17.6.1.136`.

### Qué se quitó del compose oficial (y por qué)

| Servicio oficial omitido | Motivo |
|---|---|
| **supavisor** (pooler de conexiones) | La webapp y n8n se conectan directo a `db:5432` por red interna Docker. En un VPS de 8GB compartido con Ollama (~2GB) no compensa el coste de RAM de otro servicio para el volumen esperado de Razón Común. Si en producción se agotan las conexiones directas a Postgres, añadir supavisor es sencillo (bloque disponible en el compose oficial de referencia, guardado en el historial de esta tarea). |
| **functions** (Edge Functions/Deno) | Ningún agente del equipo (`docs/tecnico/equipo-agentes.md`) tiene previsto usar Edge Functions — el RC-Brain usa n8n + rutas server de Next.js. Añadir si aparece una necesidad real. |
| **Analytics/Logflare/Vector** | Tampoco vienen en el compose oficial por defecto; no se ha añadido. |

### Qué se cambió respecto al vendor (documentado, no un descuido)

1. **`container_name` con prefijo `rc-supabase-*`** en vez de `supabase-*` — para poder identificar a simple vista en `docker ps` a quién pertenece cada contenedor en un VPS que también aloja n8n de la agencia (mitiga parte de la confusión operativa de I2, revision-seguridad.md).
2. **Volumen de datos de Postgres como volumen NOMBRADO** (`supabase-db-data`) en vez de bind-mount `./volumes/db/data` como hace el compose oficial. Motivo: en Dokploy, el directorio del compose vive dentro del árbol clonado por git; un bind-mount ahí queda expuesto a un `git clean -fdx` accidental o a que Dokploy recree el checkout. Un volumen nombrado de Docker sobrevive a eso.
3. **Puertos de Kong ligados a `127.0.0.1`** (`127.0.0.1:8000`, no `0.0.0.0:8000`) — el acceso público real pasa por la red `rc-supabase-public` (externa, la de Traefik/Dokploy), nunca por el puerto crudo del host. El bind a loopback sigue permitiendo verificar con `curl` por SSH/túnel.
4. **Red externa `rc-supabase-public`** apuntando a `${DOKPLOY_TRAEFIK_NETWORK:-dokploy-network}` — para que Dokploy pueda asignar dominios a Kong sin publicar puertos a internet. **Sin verificar contra un Dokploy real** (no hubo acceso en esta sesión): el nombre de red por defecto de Dokploy suele ser `dokploy-network`, pero quien despliegue debe confirmarlo con `docker network ls` en el VPS antes del primer `up` y corregir `DOKPLOY_TRAEFIK_NETWORK` en `.env` si difiere.
5. **`00-extensions.sql` añadido** al arranque de `db` (`CREATE EXTENSION IF NOT EXISTS vector; CREATE EXTENSION IF NOT EXISTS pg_trgm;`) — para que pgvector esté disponible antes de que corra ninguna migración de `rc-02-datos`.
6. **Rate limiting de GoTrue añadido explícitamente** (`GOTRUE_RATE_LIMIT_*`) — no viene activado por defecto en el compose oficial; es parte del hallazgo C3 de `docs/tecnico/revision-seguridad.md`. Valores de partida conservadores, no verificados contra tráfico real — ajustar en la Ola 2 con datos de uso.
7. **MFA (2FA) habilitado en GoTrue** (`GOTRUE_MFA_TOTP_ENROLL_ENABLED`, `GOTRUE_MFA_TOTP_VERIFY_ENABLED`) — infraestructura lista para que `rc-03-auth` la haga obligatoria para cargos/admins (I5, revision-seguridad.md); la obligatoriedad en sí (RLS + middleware) es trabajo de ese agente, no de este compose.

### ⏳ Decisión abierta que NO se cerró en esta sesión: cómo se expone Kong al público

`docs/tecnico/stack-y-despliegue.md` dice literalmente que "la API de Supabase (kong) queda en red interna; la webapp la consume server-side", pero GoTrue necesita que el navegador del usuario pueda llegar a `/auth/v1/verify`, `/auth/v1/callback` y `/auth/v1/authorize` para que funcionen los enlaces de email (confirmación, recuperación) y el callback de OAuth. Hay dos caminos válidos, y esta sesión NO tuvo el contexto de `rc-03-auth` (Ola 2, aún no lanzada) para decidir cuál:

- **(A) Exponer Kong en un dominio propio** (p. ej. `api.razoncomun.com`), detrás de Cloudflare, con Studio protegido en `studio.razoncomun.com` apuntando **al mismo Kong** (Kong enruta por *path*, no por *Host*, así que ambos dominios sirven el mismo conjunto de rutas — la separación es solo cosmética/DNS, la protección real de Studio la da el `basic-auth` de `kong.yml` en la ruta `/` más, opcionalmente, Cloudflare Access delante de `studio.razoncomun.com`). Es el patrón estándar de Supabase self-hosted y el que asume `.env.example` de este paquete (`SUPABASE_PUBLIC_URL=https://api.razoncomun.com`).
- **(B) Mantener Kong 100% interno** y que la webapp Next.js haga de proxy de `/auth/v1/*`, `/rest/v1/*`, etc. (rewrites de Next.js hacia `http://kong:8000` por red interna Docker), de forma que el único dominio público sea `www.razoncomun.com`. Más fiel a la frase literal del documento de arquitectura, pero es trabajo adicional de `rc-03-auth` no descrito en su brief actual.

**Recomendación de este agente: (A).** Es el patrón que Supabase soporta out-of-the-box, no añade trabajo a `rc-03-auth`, y la superficie expuesta (anon key + rate limiting + RLS) es la misma que protege a Supabase Cloud en producción. **El orquestador debe confirmarlo con Sergio o con `rc-03-auth` antes de la Ola 2** — si se opta por (B), los valores de `SUPABASE_PUBLIC_URL`/`API_EXTERNAL_URL` en `.env.example` cambian a apuntar a `www.razoncomun.com` y hay que quitar la exposición pública de Kong en Dokploy.

---

## 2. Requisitos antes de desplegar

- VPS Contabo con Dokploy instalado y funcionando (ya existe, aloja n8n de la agencia).
- ≥ 8 GB RAM libres en el VPS para el conjunto Supabase + Ollama + webapp + n8n (medir con `free -h`, ver §6).
- Dominio `razoncomun.com` gestionable (DNS delegado en Cloudflare, tier gratis).
- Cuenta SMTP transaccional creada (Brevo 300/día gratis, o Resend 3k/mes gratis) — necesaria para que Auth pueda mandar correos.
- `age` instalado en el VPS host (no dentro de un contenedor) para los backups: `apt install age` (Debian/Ubuntu ≥ 12) o descargar el binario de `https://github.com/FiloSottile/age/releases`.
- Docker + Docker Compose v2 en el VPS (los trae Dokploy).

---

## 3. Generar los secretos (antes del primer `up`)

**Nunca usar los valores de ejemplo de la documentación de Supabase — están en todos los escáneres (C3, revision-seguridad.md).**

```bash
# En cualquier máquina con openssl (no hace falta que sea el VPS):
openssl rand -hex 24        # → POSTGRES_PASSWORD (solo letras/números, ver nota abajo)
openssl rand -base64 48     # → JWT_SECRET
openssl rand -base64 48     # → SECRET_KEY_BASE
openssl rand -hex 8         # → REALTIME_DB_ENC_KEY (exactamente 16 caracteres)
openssl rand -base64 24     # → PG_META_CRYPTO_KEY
openssl rand -base64 18     # → DASHBOARD_PASSWORD (asegurar que tiene letras, no solo números)
openssl rand -hex 16        # → S3_PROTOCOL_ACCESS_KEY_ID
openssl rand -hex 32        # → S3_PROTOCOL_ACCESS_KEY_SECRET
```

> `POSTGRES_PASSWORD` debe contener **solo letras y números** — con símbolos especiales puede romper el URL-encoding de las cadenas de conexión que usan varios servicios del stack.

**ANON_KEY y SERVICE_ROLE_KEY son JWT firmados con `JWT_SECRET`, no se generan con `openssl` a mano.** Usar el script oficial:

```bash
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env
# Editar .env: pegar el JWT_SECRET ya generado arriba
sh utils/generate-keys.sh   # imprime ANON_KEY y SERVICE_ROLE_KEY listos para copiar
```

Copiar los valores resultantes a `infra/.env` (creado a partir de `infra/.env.example`).

**Clave de backups (age):**
```bash
age-keygen -o rc-backup-key.txt
# Salida: "# public key: age1..." (va en AGE_RECIPIENT_PUBLIC_KEY) y una línea
# AGE-SECRET-KEY-1... (la clave PRIVADA — guardarla OFFLINE, fuera del VPS,
# nunca en el repo ni en Dokploy. Sin ella, los backups no se pueden restaurar.)
```

---

## 4. Desplegar el stack de Supabase en Dokploy

1. **Dokploy → Proyectos → Nuevo proyecto** `razoncomun` (si no existe ya).
2. **Nuevo servicio → Docker Compose**, apuntando al repo `github.com/estudiohz/razoncomun`, rama `main`, **ruta del compose**: `infra/docker-compose.supabase.yml`. Confirmar en la config de Dokploy que usa `infra/` como directorio base (para que las rutas relativas `./supabase/volumes/...` del compose resuelvan bien) — **verificar este punto en el propio panel al desplegar, no se pudo probar en esta sesión sin acceso**.
3. **Variables de entorno**: pegar el contenido completo de `infra/.env` (ya relleno, nunca el `.env.example`) en la pestaña "Environment" del servicio.
4. **Antes del primer `docker compose up`**: confirmar el nombre real de la red de Traefik de Dokploy:
   ```bash
   docker network ls | grep -i dokploy
   ```
   Si no es `dokploy-network`, corregir `DOKPLOY_TRAEFIK_NETWORK` en las variables de entorno del servicio.
5. **Deploy.** Dokploy ejecuta el equivalente a `docker compose up -d`.
6. **Verificar salud de cada contenedor:**
   ```bash
   docker compose -f infra/docker-compose.supabase.yml ps
   # Todos deben decir "healthy" o "running" en menos de 1 minuto.
   ```
7. **Verificar por curl (dentro del VPS, vía SSH, contra el bind a loopback):**
   ```bash
   curl -i http://127.0.0.1:8000/auth/v1/health
   curl -i -H "apikey: $ANON_KEY" http://127.0.0.1:8000/rest/v1/
   ```

### Dominios (Dokploy → pestaña Domains del servicio)

- `api.razoncomun.com` → servicio `kong`, puerto contenedor `8000`, HTTPS automático (Let's Encrypt vía Dokploy).
- `studio.razoncomun.com` → mismo servicio `kong`, mismo puerto `8000` (ver §1, ambos dominios sirven las mismas rutas; la separación es de nombre, no de backend).
- Verificar con:
  ```bash
  curl -I https://api.razoncomun.com/auth/v1/health
  curl -I https://studio.razoncomun.com/
  ```
  El segundo debe devolver `401` (basic-auth de Kong pidiendo `DASHBOARD_USERNAME`/`DASHBOARD_PASSWORD`) — si devuelve `200` sin pedir credenciales, algo está mal configurado y **hay que pararse antes de seguir**.

### Cloudflare delante (C6, revision-seguridad.md)

1. Delegar `razoncomun.com` en Cloudflare (tier gratis).
2. Activar proxy (nube naranja) en los registros `api`, `studio`, `www`.
3. WAF: activar el ruleset gestionado gratuito.
4. **Opcional pero recomendado para Studio:** Cloudflare Access (Zero Trust, gratis hasta 50 usuarios) con una política que restrinja `studio.razoncomun.com` a los emails del equipo — capa adicional sobre el basic-auth de Kong, no un sustituto.
5. Verificar que la IP real del VPS ya no es visible: `dig api.razoncomun.com` debe devolver una IP de Cloudflare, no la del Contabo.

### SMTP (C3)

Rellenar en `.env`: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_ADMIN_EMAIL`, `SMTP_SENDER_NAME` con las credenciales de Brevo o Resend. Configurar SPF/DKIM en el DNS de Cloudflare siguiendo las instrucciones del proveedor elegido.

**Verificación obligatoria antes de dar la Ola 0 por cerrada:** disparar un registro de prueba y confirmar que el correo de confirmación llega a una bandeja real (no solo que el endpoint devuelve `200`).

---

## 5. Desplegar Ollama + bge-m3

1. Dokploy → mismo proyecto → **Nuevo servicio → Docker Compose** → `infra/docker-compose.ollama.yml`.
2. Sin dominio público (el servicio usa `expose`, no `ports` — solo alcanzable desde otros contenedores de su red).
3. Tras el primer `up`:
   ```bash
   docker exec -it rc-ollama ollama pull bge-m3
   docker exec -it rc-ollama ollama list        # confirmar que aparece bge-m3
   ```
4. **Unir la red `rc-ollama-internal` a n8n y a los scripts de ingesta de `rc-08-brain`** cuando lleguen esas olas — decisión de red concreta pendiente de cómo esté desplegado n8n (ver I2, revision-seguridad.md).
5. **Medir RAM inmediatamente después de cargar el modelo** (obligatorio, revision-seguridad.md):
   ```bash
   free -h
   docker stats --no-stream rc-ollama
   ```
   Anotar el resultado en la sección "Estado actual" (§10) de este documento. Si la RAM total del VPS aprieta con Supabase + n8n + webapp + Ollama simultáneos, servir bge-m3 con **TEI** (`huggingface/text-embeddings-inference`) en vez de Ollama — mismo modelo, mismo `vector(1024)`, menor huella de runtime.

---

## 6. Desplegar la webapp (`apps/web`)

Este agente solo entrega `apps/web/Dockerfile`; el resto del proyecto Next.js es de `rc-04-front`. Cuando ese proyecto exista:

1. Dokploy → **Nuevo servicio → Application**, tipo **Dockerfile**, repo `github.com/estudiohz/razoncomun`, rama `main`, ruta del Dockerfile: `apps/web/Dockerfile`, contexto de build: `apps/web/`.
2. Auto-deploy en cada push a `main`.
3. Variables de entorno del servicio (las define cada agente dueño de la funcionalidad, no viven en `infra/`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (públicas, cliente), `SUPABASE_SERVICE_ROLE_KEY` (server-only, **nunca** `NEXT_PUBLIC_*`), `STRIPE_*`, `GOOGLE_OAUTH_*`, etc.
4. Dominio `www.razoncomun.com` (y `razoncomun.com` con redirect a `www`).
5. Verificar: `curl -I https://www.razoncomun.com` → `200`.

---

## 7. Backups cifrados (C4)

### Instalación del cron en el VPS host

```bash
# Como root o usuario con permisos docker:
crontab -e
# Añadir (todos los días a las 03:15 UTC):
15 3 * * * cd /ruta/al/repo/razoncomun && set -a && source infra/.env && set +a && infra/backup/backup-pg-encrypted.sh >> /var/log/rc-backup.log 2>&1
```

`BACKUP_DIR` (definido en `.env`) debe apuntar **fuera** del árbol git del repo (p. ej. `/opt/rc-backups`), nunca dentro del checkout.

### Verificación tras el primer backup

```bash
ls -la /opt/rc-backups/daily/
# El archivo .sql.gz.age debe pesar más que unos pocos cientos de bytes
# (el propio script ya aborta si es sospechosamente pequeño)
```

### Ensayo de restauración (obligatorio antes de producción, C4)

```bash
export AGE_IDENTITY_FILE=/ruta/segura/rc-backup-key.txt   # la clave PRIVADA, traída solo para este ensayo
infra/backup/restore-pg-encrypted.sh --dry-run /opt/rc-backups/daily/rc-supabase-<timestamp>.sql.gz.age
```

Esto levanta un Postgres **efímero** (contenedor `rc-restore-drill`, puerto `55432`, nunca toca `rc-supabase-db`), aplica el dump y cuenta las tablas restauradas. Al terminar:

```bash
docker rm -f rc-restore-drill
```

**El pipeline de cifrado/descifrado (`gzip | age -r ... | ... | age --decrypt | gunzip`) se probó end-to-end en la sesión que preparó este paquete**, con un fichero de texto sustituyendo a la salida de `pg_dump` (no había Docker disponible en ese entorno de preparación, así que no se pudo levantar `rc-supabase-db` ni el Postgres efímero real) — el roundtrip fue exacto (diff limpio). La lógica de rotación/retención (`find` + `awk` conservando los N más recientes) también se probó de forma aislada. Lo que **falta probar** es el flujo `--dry-run` completo contra un `pg_dump` real de la base de datos del stack ya desplegado — hacerlo una vez, sin excepciones, antes de abrir producción.

### Copia externa semanal

El script deliberadamente NO sube nada a un tercero por defecto (evita atar la infra a un proveedor sin decisión de Sergio). El archivo ya sale cifrado con age del VPS, así que subirlo tal cual con `rclone` (Backblaze B2 free tier 10GB) o `rsync` a otra máquina del partido no añade riesgo. Configurar esto como una tarea aparte cuando se decida el proveedor.

---

## 8. Checklist de endurecimiento (C3-C6, revision-seguridad.md) — estado de cada punto

| Punto | Dónde se resuelve | Estado en este paquete |
|---|---|---|
| RLS en todas las tablas expuestas | `supabase/migrations/` (rc-02-datos) | Pendiente — no es trabajo de rc-01 |
| `service_role` solo server-side | Disciplina de `apps/web` (rc-03/rc-04) + nunca en `infra/` | N/A para rc-01, pero `.env.example` lo advierte explícitamente |
| Studio y Dokploy nunca abiertos sin protección | Kong basic-auth (ya en `kong.yml`) + Cloudflare Access recomendado | ✅ Preparado, sin verificar contra Dokploy real |
| 2FA en el panel de Dokploy, SSH solo con clave | Configuración del propio Dokploy/VPS, no de este repo | 👤 Tarea de Sergio — no automatizable desde aquí |
| Secretos regenerados (no los de ejemplo) | `infra/.env.example` fuerza a generarlos, sin defaults | ✅ Ningún valor por defecto en secretos |
| Rate limiting de GoTrue | `docker-compose.supabase.yml`, servicio `auth` | ✅ Activado con valores de partida |
| SMTP real con SPF/DKIM | §4 de esta guía | Pendiente de cuenta real (Sergio) |
| Backups cifrados + retención + ensayo | `infra/backup/` | ✅ Scripts listos y probado el pipeline de cifrado; ensayo real contra Postgres de verdad pendiente de VPS |
| `.gitignore` de secretos, secret scanning en GitHub | `.gitignore` raíz | ✅ Añadido. Secret scanning/push protection: activar en GitHub → Settings → Security (repo público, gratis) — 👤 tarea de Sergio, requiere acceso admin al repo en GitHub |
| Cloudflare delante de todo lo público | §4 de esta guía | Pendiente de ejecución real |

---

## 9. Qué necesita `rc-01-infra` para pasar de "preparado" a "desplegado" (D-002)

Formato exacto de cada acceso, para que quien los facilite sepa qué generar:

1. **Token de la API de Dokploy** (Dokploy → Settings → API Tokens, o el usuario/contraseña del panel si no hay API token en esa versión) — con permisos de crear proyectos/servicios en el panel usado por Razón Común.
2. **O, alternativamente, SSH al VPS**: usuario con permisos `docker` (grupo `docker` o `sudo`), autenticación por clave (no contraseña), IP/hostname del VPS.
3. **(Opcional, para DNS automatizado) Token de la API de Cloudflare**, scope mínimo: `Zone:DNS:Edit` sobre la zona `razoncomun.com`.
4. **Cuenta SMTP creada** (Brevo o Resend) con su API key/contraseña SMTP — o acceso para crearla si no existe.
5. **Confirmación de la decisión ⏳ del §1** (cómo se expone Kong) antes de la Ola 2, para no tener que redesplegar dominios a mitad de camino.

Con (1) o (2) el agente en modo ejecución puede desplegar todo lo de esta guía él mismo, verificando cada paso con evidencia (igual que se haría a mano), según D-002 (`docs/tecnico/decisiones-construccion.md`).

---

## 10. Estado actual (actualizar cada vez que algo cambie de verdad en el VPS)

**19/07/2026 — rc-01-infra, Ola 0, modo preparación.** Nada desplegado todavía. Paquete completo entregado en el repo, pendiente de credenciales (§9).

<!-- Próxima entrada: fecha, qué se desplegó, comando de verificación usado, resultado exacto. -->

---

## 11. Cómo repetir todo desde cero (rebuild-from-scratch)

1. Clonar el repo: `git clone https://github.com/estudiohz/razoncomun && cd razoncomun`.
2. `cp infra/.env.example infra/.env` y rellenar cada `[SECRETO]` siguiendo §3 de esta guía.
3. Confirmar `DOKPLOY_TRAEFIK_NETWORK` con `docker network ls`.
4. Desplegar `infra/docker-compose.supabase.yml` en Dokploy (§4), luego `infra/docker-compose.ollama.yml` (§5), luego `apps/web/Dockerfile` (§6).
5. Instalar el cron de backups (§7) y ejecutar un ensayo de restauración antes de considerar el sistema listo para producción.
6. Repetir la checklist de §8 entera.

Este documento debería ser suficiente, por sí solo, para que alguien sin ningún contexto previo de esta sesión levante el mismo sistema otra vez.
