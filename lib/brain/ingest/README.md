# RC-Brain — Pipeline de ingesta + embeddings (Ola 1, rc-08-brain)

> Salida 1 de rc-08-brain (`docs/tecnico/plan-lanzamiento.md`): **solo** el pipeline de
> ingesta/embeddings. El chat "Pregunta a Razón Común", el bot de Discord, el
> clasificador de Opina y los workflows n8n son la Ola 3 — no viven aquí todavía.

## Qué hace

Lee el corpus (manifiesto + documentación del proyecto), lo trocea, genera
embeddings de 1024 dimensiones con `bge-m3` (Ollama) y los escribe en
`public.brain_documents` (propiedad de `rc-02-datos`, esquema fijado, no se
toca aquí). Idempotente: se puede re-ejecutar cuantas veces haga falta —
antes de insertar los chunks nuevos de un documento, borra los suyos
anteriores (por `source` + una clave de idempotencia en `metadata`).

## Por qué cero dependencias

Todo el código (`src/*.mjs`) usa solo built-ins de Node 20+ (`fetch` global,
`node:fs/promises`, `node:path`). No hay `npm install` en el `Dockerfile`.
Motivo: es un job pequeño, de un solo propósito, que se audita fácil (repo
público) y no arrastra un `node_modules` ni superficie de supply-chain para
algo que no lo necesita.

## Cómo llega este job a Postgres — decisión de diseño

El brief original sugería una conexión TCP directa a `db:5432` dentro de la
red interna de Supabase (`rc-supabase-internal`, ver `infra/docker-compose.supabase.yml`).
**Se decidió usar en su lugar el endpoint HTTPS de pg-meta ya expuesto por
Kong**: `POST {SUPABASE_PUBLIC_URL}/pg/query`, con `service_role` (ver
`kong.yml`: la ruta `/pg/*` exige `key-auth` + grupo ACL `admin`, que es
justo `service_role`).

Motivos:
1. **Un único camino de código, probado de verdad en dos sitios.** El mismo
   `src/pgClient.mjs` funciona sin cambios en producción (dentro del VPS) y
   en esta máquina de desarrollo (sin acceso a la red Docker del VPS) — así
   es como se pudieron correr pruebas reales contra la base de datos real
   antes de desplegar nada (ver "Qué se probó" más abajo).
2. **Evita la ambigüedad de redes cruzadas entre stacks de Dokploy.**
   `rc-supabase-internal` no está declarada `external: true` en el compose
   de Supabase — para que un contenedor de OTRO stack Compose se una a ella
   habría que descubrir el nombre real que Docker le asignó (`docker network
   ls` en el VPS) y no hay garantía de que Dokploy no cambie ese prefijo. El
   endpoint HTTPS ya está verificado funcionando end-to-end (D-005 en
   `docs/tecnico/decisiones-construccion.md`) y no depende de qué red Docker
   exista en cada stack.
3. **`brain_documents` no tiene RLS para nadie salvo `service_role`** (migración
   `0012_brain.sql`), así que de todas formas hace falta esa clave — usar el
   endpoint HTTPS con ella no añade superficie nueva.

Contrapartida asumida: sin transacciones ACID multi-sentencia estrictas (cada
sentencia SQL es una llamada HTTP independiente) y sin placeholders
parametrizados server-side — el escapado seguro de literales lo hace
`src/sqlLiteral.mjs` (comillas dobladas, validación de tipo antes de
interpolar). Para el volumen de este pipeline (cientos-miles de chunks, no
tráfico transaccional concurrente) es una simplificación razonable.

## Redes: cómo llega este job a Ollama

Ollama **sí** debe alcanzarse por red interna Docker — es una decisión
deliberada de `rc-01-infra` no exponerlo a internet (`infra/docker-compose.ollama.yml`).
El contenedor de este job debe unirse a la red `rc-ollama-internal`.

Como esa red tampoco está declarada `external: true` en el compose de Ollama
(mismo problema que con Supabase, pero aquí no hay atajo HTTP porque Ollama
no está detrás de Kong), `docker-compose.brain-ingest.yml` la referencia como
`external: true` con un nombre por defecto razonado (`rc-ollama_rc-ollama-internal`,
según cómo Compose v2 nombra redes no-externas cuando el archivo declara
`name: rc-ollama`), **pero hay que confirmarlo en el VPS antes del primer
despliegue**:

```bash
docker network ls | grep ollama
```

Si el nombre real difiere, pasar `OLLAMA_INTERNAL_NETWORK=<nombre-real>` como
variable de entorno del servicio en Dokploy.

## Corpus de documentos: por qué NO vive en este repo público

`docs/ideario/`, `docs/tecnico/` y `docs/marca/` viven en un repositorio
**privado** de documentación (ver `README.md` raíz: "no vive en este repo de
código"), separado de `github.com/estudiohz/razoncomun` (público). Esto es
deliberado y hay que respetarlo, especialmente para `docs/tecnico/`:
contiene el análisis de seguridad en curso (`revision-seguridad.md`),
decisiones de infraestructura con detalles operativos del VPS
(`decisiones-construccion.md`, `stack-y-despliegue.md`) y el modelo de datos
completo. Aunque el chat público solo consulta `visibility='public'` en
`brain_documents`, **estar en un repo público es otra cosa**: cualquiera
puede leer el `.md` en crudo desde GitHub sin pasar por ninguna política de
`visibility`. Publicar ese contenido tal cual sería entregar a un adversario
un mapa detallado de qué está reforzado y qué no — lo contrario de lo que
persigue C5 (transparencia del *código*, no de la postura de seguridad en
construcción).

**Decisión de este agente:** el corpus de documentos NO se copia al repo.
Se monta como bind mount de solo lectura en el contenedor, poblado en el
host del VPS fuera de git (mismo patrón que ya usa `infra/backup/` para
`BACKUP_DIR`, fuera del árbol del repo):

```
/opt/rc-corpus/
├── public/           <- visibility='public' en brain_documents
│   ├── ideario/*.md  (principios, democracia-semidirecta, programa-vivo,
│   │                  estructura-organizativa: filosofía del partido —
│   │                  pública por diseño, punto 25 del manifiesto:
│   │                  "prohibido el silencio estratégico")
│   └── marca/*.md    (identidad visual: guía de marca, sin nada sensible)
└── internal/
    └── tecnico/*.md  <- visibility='internal' (solo para el futuro bot de
                          equipo en Discord, Ola 3 — nunca para el chat público)
```

**Poblarlo (una vez, y cada vez que cambien los docs)**, desde la máquina
que tiene el repo de documentación clonado:

```bash
# Ejemplo con rsync sobre SSH (ajustar host/ruta al VPS real):
rsync -av --delete "docs/ideario/" usuario@vps:/opt/rc-corpus/public/ideario/
rsync -av --delete "docs/marca/"   usuario@vps:/opt/rc-corpus/public/marca/
rsync -av --delete "docs/tecnico/" usuario@vps:/opt/rc-corpus/internal/tecnico/
```

O, si el orquestador despliega con la misma API/SSH de Dokploy usada en
D-004/D-005, cualquier mecanismo equivalente de copia (scp, `docker cp` a un
volumen, etc.) — lo único que importa es que el contenido llegue a esas tres
rutas en el host **sin pasar por el repo público**.

**Alternativa descartada (a propósito):** copiar `docs/` al repo público
(`lib/brain/corpus/`). Habría sido más simple operativamente (nada que
sincronizar fuera de git) pero incumple la separación público/privado ya
establecida para la documentación del proyecto y publicaría contenido de
seguridad en curso. Si Sergio prefiere esa vía para *solo* `ideario/` y
`marca/` (que son públicos por naturaleza, no `tecnico/`), es un cambio de
una tarde — decidir explícitamente, no asumir.

**Mapeo de `source` (limitación de esquema, no de este código):** el `CHECK`
de `brain_documents.source` (propiedad de rc-02, no se toca) admite:
`manifiesto | estatutos | blog | decision | opinion | video | estudio`.
Ninguno describe con precisión "documentación de ideario/técnico/marca". Se
usa `estudio` como el menos incorrecto (rc-brain.md ya lo describe como
corpus de referencia/informes) y se guarda el área real en
`metadata.area` (`ideario`, `marca`, `tecnico`) para no perder la
distinción. **Sugerencia para rc-02**, no bloqueante: añadir un valor propio
(p. ej. `'docs'`) en una futura migración.

## Chunking

`src/chunking.mjs`: parte por encabezados Markdown (`#`/`##`/`###`), agrupa
párrafos hasta ~1100 caracteres con ~150 de solape (configurable por env),
sin partir nunca un párrafo por la mitad, y antepone la ruta de encabezados
como contexto a cada chunk (mejora mucho la recuperación de fragmentos
cortos). Los puntos del manifiesto (36-91 caracteres de cuerpo, muy cortos)
generan **un chunk por punto** con el título antepuesto.

## Qué se probó (evidencia real) y qué queda pendiente

Ollama **no es alcanzable desde esta máquina** (red interna del VPS, por
diseño — ver brief). Por tanto, todo lo que depende de generar embeddings
*semánticamente reales* con `bge-m3` queda pendiente del despliegue en el
VPS. Lo que SÍ se pudo probar de verdad, contra el Postgres real
(`brain_documents`, vía el mismo endpoint HTTPS que usa producción):

1. **Chunking sobre contenido real.** Los 16 ficheros de
   `docs/ideario` + `docs/marca` + `docs/tecnico` producen 186 chunks
   (38 público + 148 interno) con el chunker de este pipeline. Sumados a los
   30 puntos del manifiesto (1 chunk cada uno): **216 chunks en total**
   esperados en el primer despliegue real. Verificado con
   `node src/index.mjs --sources=manifiesto,docs --dry-run` (ver salida
   completa en el informe de esta ola).
2. **Mecánica de idempotencia**, con `EMBEDDINGS_PROVIDER=mock` (vectores
   deterministas, NO semánticos — solo para probar inserción/borrado/orden,
   bloqueado salvo `RC_BRAIN_TEST_RUN=1`) contra la tabla real, con filas
   marcadas y borradas al terminar (no queda ningún resto):
   - 1ª ingesta de 2 documentos de prueba → 3 chunks insertados.
   - 2ª ingesta idéntica → sigue en 3 (no 6): el delete-then-insert funciona.
   - 3ª ingesta con contenido cambiado → pasa a 2 chunks correctamente.
   - Orden por similitud coseno: la consulta con el texto exacto de un chunk
     devuelve ese chunk en primer lugar con similitud `1.0` exacta.
3. **Dimensión e índice**, contra la tabla real:
   - `atttypmod` de la columna `embedding` = `1024` ✅.
   - Con 600 filas de prueba insertadas (mock) + `ANALYZE`, `EXPLAIN (FORMAT
     JSON)` sobre `ORDER BY embedding <=> ... LIMIT 5` elige **Index Scan
     using brain_documents_embedding_ivfflat_idx** por decisión propia del
     planificador (sin forzar nada) — confirmado también con
     `enable_seqscan=off`. Limpiado por completo al terminar
     (`brain_documents` quedó en 0 filas, igual que antes de la prueba).

**Lo que NO se pudo verificar en esta sesión** (requiere `bge-m3` real en el
VPS): las 5 preguntas de control deben devolver el punto/documento correcto
por similitud semántica real, y las 3 preguntas fuera de corpus deben dar
similitud baja. `src/controlQuestions.mjs` ya implementa ambas pruebas —
solo falta ejecutarlas tras el despliegue (ver siguiente sección). Con
`EMBEDDINGS_PROVIDER=mock` estas pruebas no tienen ningún valor semántico
(vectores aleatorios no relacionados con el texto), así que no se han
"simulado" para no reportar un resultado engañoso.

## Cómo desplegar y verificar (para quien tenga acceso al VPS)

```bash
# 1. Confirmar el nombre real de la red de Ollama:
docker network ls | grep ollama

# 2. Poblar el corpus de documentos en el host (ver sección de arriba).

# 3. Desplegar en Dokploy:
#    Nuevo servicio -> Docker Compose -> repo github.com/estudiohz/razoncomun,
#    rama main, ruta: lib/brain/ingest/docker-compose.brain-ingest.yml
#    Variables de entorno: SUPABASE_PUBLIC_URL, SERVICE_ROLE_KEY (copiar de
#    la config del servicio "rc-supabase", D-004) y OLLAMA_INTERNAL_NETWORK
#    si el paso 1 dio un nombre distinto al default.

# 4. Verificar el resultado en los logs del servicio (Dokploy): debe terminar
#    con el resumen "Documentos procesados / Chunks insertados / ..." y
#    exit code 0.

# 5. Confirmar el conteo real:
curl -sS -X POST "https://dev-api.razoncomun.com/pg/query" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"select source, visibility, count(*) from brain_documents group by 1,2 order by 1,2;"}'

# 6. Correr las preguntas de control (dentro de un contenedor con acceso a
#    Ollama, p. ej. `docker compose run --rm brain-ingest node src/controlQuestions.mjs`
#    o añadiendo un servicio puntual equivalente):
EMBEDDINGS_PROVIDER=ollama node src/controlQuestions.mjs
```

## Variables de entorno

Ver `.env.example` (documentado línea a línea). Nunca commitear `.env` real
— el `SERVICE_ROLE_KEY` bypassa RLS sobre toda la base de datos, no solo
`brain_documents`.

## Re-ejecución (mantenimiento normal)

Volver a lanzar el servicio en Dokploy (o `docker compose up` de nuevo) es
siempre seguro: cada documento se identifica por su clave de idempotencia
(`point_id` para el manifiesto, `file` para los docs) y se borra-e-inserta
entero, así que un cambio en el manifiesto o en la documentación se refleja
sin duplicados ni basura de la versión anterior. Cuando existan `articles`
(blog, Ola 3 con rc-05) y `decisions`/`opinions`, extender con nuevos
conectores en `src/connectors/` siguiendo la misma forma (`{ source, refId,
visibility, idempotencyKey, chunks }`) que ya usan `manifesto.mjs` y
`corpusDocs.mjs`.
