# RC-Brain — Pipeline de ingesta + embeddings (Ola 1, rc-08-brain)

> Salida 1 de rc-08-brain (`docs/tecnico/plan-lanzamiento.md`): **solo** el pipeline de
> ingesta/embeddings. El chat "Pregunta a Razón Común", el bot de Discord, el
> clasificador de Opina y los workflows n8n son la Ola 3 — no viven aquí todavía.

**Estado: Ola 1 cerrada por el orquestador (D-010).** Manifiesto desplegado e
indexado con `bge-m3` real (30 chunks, dimensión 1024, normas de vector
25,2–27,0), 5 preguntas de control + 3 fuera-de-corpus verificadas contra
Ollama real, servicio `brain-control` en el compose autoverifica cada
despliegue. El corpus de documentación (`docs/ideario`, `docs/marca`,
`docs/referencias`, `docs/vision-plataforma.md`/`50-ideas-acogida.md`) se
sirve ahora desde Supabase Storage (ver más abajo) — pendiente de que el
orquestador despliegue esta versión del job para verificar sus conteos reales
contra Ollama.

## Qué hace

Lee el corpus (manifiesto + documentación del proyecto), lo trocea, genera
embeddings de 1024 dimensiones con `bge-m3` (Ollama) y los escribe en
`public.brain_documents` (propiedad de `rc-02-datos`, esquema fijado, no se
toca aquí). Idempotente: se puede re-ejecutar cuantas veces haga falta —
antes de insertar los chunks nuevos de un documento, borra los suyos
anteriores (por `source` + una clave de idempotencia en `metadata`).

## Por qué cero dependencias

Todo el código (`src/*.mjs`) usa solo built-ins de Node 20+ (`fetch` global,
`TextDecoder`, `node:path` donde hace falta). No hay `npm install` en el
`Dockerfile`. Motivo: es un job pequeño, de un solo propósito, que se audita
fácil (repo público) y no arrastra un `node_modules` ni superficie de
supply-chain para algo que no lo necesita.

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
   en una máquina de desarrollo sin acceso a la red Docker del VPS — así se
   pudieron correr pruebas reales contra la base de datos real antes de
   desplegar nada.
2. **Evita la ambigüedad de redes cruzadas entre stacks de Dokploy.**
   `rc-supabase-internal` no está declarada `external: true` en el compose
   de Supabase — unirse a ella desde OTRO stack Compose exige descubrir el
   nombre real que Docker le asignó, y Dokploy antepone su propio prefijo de
   proyecto (confirmado en la práctica, ver más abajo). El endpoint HTTPS ya
   está verificado funcionando end-to-end (D-005) y no depende de qué red
   Docker exista en cada stack.
3. **`brain_documents` no tiene RLS para nadie salvo `service_role`**
   (migración `0012_brain.sql`), así que de todas formas hace falta esa
   clave — usar el endpoint HTTPS con ella no añade superficie nueva.

Contrapartida asumida: sin transacciones ACID multi-sentencia estrictas (cada
sentencia SQL es una llamada HTTP independiente) y sin placeholders
parametrizados server-side — el escapado seguro de literales lo hace
`src/sqlLiteral.mjs` (comillas dobladas, validación de tipo antes de
interpolar).

## Redes: cómo llega este job a Ollama

Ollama **sí** debe alcanzarse por red interna Docker — es una decisión
deliberada de `rc-01-infra` no exponerlo a internet
(`infra/docker-compose.ollama.yml`). El contenedor de este job (y el de
`brain-control`) deben unirse a esa red.

Como esa red no está declarada `external: true` en el compose de Ollama,
`docker-compose.brain-ingest.yml` la referencia como `external: true` con un
nombre configurable por variable de entorno. **Confirmado en el primer
despliegue real (D-010): el nombre NO es el que se podía anticipar por el
`name:` del compose de Ollama — Dokploy antepone un `appName` generado por
stack** (en ese despliegue fue
`compose-transmit-solid-state-driver-l7gn7j_rc-ollama-internal`). Esto puede
volver a cambiar en el siguiente despliegue de este servicio si Dokploy
genera un `appName` distinto — **verificar con `docker network ls | grep
ollama` antes de cada deploy**, no solo el primero, y pasar
`OLLAMA_INTERNAL_NETWORK=<nombre-real>` como variable de entorno del
servicio en Dokploy si no coincide con el default.

## Corpus de documentos: de bind mount a Supabase Storage (D-010)

**Historia de esta decisión (para que no se repita el análisis):** la
versión original de este pipeline evitaba copiar `docs/ideario`,
`docs/tecnico` y `docs/marca` al repo público (razonamiento íntegro más
abajo) montándolos como bind mount de solo lectura, poblado por `rsync`/`scp`
en el host del VPS. Esa vía quedó bloqueada: desplegar el bind mount requiere
SSH al VPS, que no estaba disponible en el momento del primer despliegue real
(Ola 1). **El orquestador resolvió el bloqueo subiendo el corpus a un bucket
PRIVADO de Supabase Storage** (`corpus`) y me pidió sustituir el conector de
bind mount por uno que lea de ahí — es lo que hace
`src/connectors/corpusStorage.mjs`.

Por qué Storage no reabre el problema de seguridad que evitaba el bind
mount: el bucket es **privado** (confirmado: listar/descargar sin
`service_role` devuelve 400; con `service_role`, 200) y **`docs/tecnico/` NO
se subió** — ver el motivo en la siguiente sección. Es la misma separación
público/privado, solo que el "fuera del repo" ahora es Storage en vez de un
directorio del host.

### Por qué `docs/tecnico/` sigue excluido (decisión del orquestador, no revertir)

`docs/tecnico/` contiene el análisis de seguridad en curso
(`revision-seguridad.md`) y detalles operativos del VPS
(`decisiones-construccion.md`, `stack-y-despliegue.md`, `modelo-datos.md`).
La versión original de este pipeline lo iba a ingerir marcado
`visibility='internal'` (solo para el futuro bot de equipo). El orquestador
**lo descartó por completo, no solo lo marcó interno**: aporta poco al
cerebro (describe cómo se construyó la web, no qué piensa el partido) y un
fallo en el filtro de `visibility` del chat público expondría material que
ayuda a atacar la infraestructura — riesgo asimétrico. Este código lo refleja
en dos capas, no solo por omisión:
1. El bucket `corpus` simplemente no tiene una carpeta `tecnico/` (verificado).
2. `FOLDER_VISIBILITY` en `corpusStorage.mjs` es una **lista blanca** de
   carpetas reconocidas (`ideario`, `marca`, `referencias`, `general`).
   Cualquier carpeta que no esté ahí —incluida `tecnico` si algún día
   apareciera en el bucket por error— se **ignora con un aviso**, nunca se
   ingiere "por si acaso".

### Mapeo carpeta → visibilidad (fijado por el orquestador)

| Carpeta del bucket | `visibility` | Motivo |
|---|---|---|
| `ideario/*` | `public` | Filosofía del partido — punto 25 del manifiesto: "prohibido el silencio estratégico" |
| `marca/*` | `public` | Identidad visual, sin nada sensible |
| `referencias/*` | `public` | Es posición pública del partido (benchmark, ejemplos internacionales que informan la estrategia) |
| `general/*` | `internal` | Visión de producto y estrategia de captación (`vision-plataforma.md`, `50-ideas-acogida.md`) — útil para el cerebro interno, no para el chat público |

Esto difiere del mapeo que proponía la versión de bind mount de este agente
(que agrupaba todo lo no-`tecnico` como `public` sin la categoría
`referencias`/`general` diferenciada) — es un cambio de criterio del
orquestador, aplicado tal cual.

### Codificación — lección de D-009 aplicada aquí

`docs/tecnico/decisiones-construccion.md` documenta un bug real detectado en
esta misma ola: los seeds se aplicaron con doble codificación UTF-8 (`ó` →
`Ã³`) porque el transporte HTTP no declaraba el charset — silencioso, sin
ningún síntoma visible (HTTP 200, conteos correctos), y llegó a corromper el
93% de `brain_documents` antes de detectarse, con embeddings calculados sobre
texto roto. Este conector:

1. Descarga el objeto como bytes (`arrayBuffer()`), nunca `res.text()` a
   ciegas.
2. Decodifica **explícitamente** como UTF-8 con `new TextDecoder("utf-8",
   {fatal:true})` — si hubiera una secuencia de bytes inválida, lanza en vez
   de sustituir silenciosamente por `U+FFFD`.
3. Escanea el texto ya decodificado en busca de `U+00C3` ("Ã"): esa letra no
   existe en español, así que su presencia es la huella casi inequívoca de
   mojibake que ya venía roto antes de llegar aquí. Si aparece, **rechaza el
   documento entero con un error**, no lo indexa "total, ya se verá".

**Comprobación real (verificación de este agente, no solo del orquestador):**
descarga real de `ideario/principios.md` desde el bucket, decodificado con
`TextDecoder({fatal:true})` → 3564 bytes, 3505 caracteres, **0 apariciones de
`U+00C3`**, acentos correctos (`QUÉ`, `POR QUÉ`) en el texto resultante.

### Mapeo de `source` (limitación de esquema, no de este código)

El `CHECK` de `brain_documents.source` (propiedad de rc-02, no se toca)
admite: `manifiesto | estatutos | blog | decision | opinion | video |
estudio`. Ninguno describe con precisión "documentación de ideario/marca/
referencias/visión". Se usa `estudio` como el menos incorrecto y se guarda
el área real en `metadata.area` (`ideario`, `marca`, `referencias`,
`general`) para no perder la distinción. **Sugerencia para rc-02**, no
bloqueante: añadir un valor propio (p. ej. `'docs'`) en una futura migración.

## Chunking

`src/chunking.mjs`: parte por encabezados Markdown (`#`/`##`/`###`), agrupa
párrafos hasta ~1100 caracteres con ~150 de solape (configurable por env),
sin partir nunca un párrafo por la mitad, y antepone la ruta de encabezados
como contexto a cada chunk. Los puntos del manifiesto (36-91 caracteres de
cuerpo, muy cortos) generan **un chunk por punto** con el título antepuesto.

## Conteos reales (verificados contra el bucket/BD reales de esta sesión)

**Manifiesto (ya desplegado, D-010):** 30 puntos → 30 chunks, `visibility='public'`,
`source='manifiesto'`, embeddings `bge-m3` reales (norma 25,2–27,0).

**Corpus de documentos (Storage, pendiente de desplegar con esta versión):**
9 ficheros `.md` en el bucket → **82 chunks**, `source='estudio'`:

| Fichero | Chunks | `visibility` |
|---|---|---|
| `ideario/democracia-semidirecta.md` | 6 | public |
| `ideario/estructura-organizativa.md` | 7 | public |
| `ideario/principios.md` | 9 | public |
| `ideario/programa-vivo.md` | 7 | public |
| `marca/identidad-visual.md` | 9 | public |
| `referencias/benchmark-vox.md` | 5 | public |
| `referencias/ejemplos-internacionales.md` | 8 | public |
| `general/50-ideas-acogida.md` | 8 | internal |
| `general/vision-plataforma.md` | 23 | internal |

**Total esperado tras el despliegue de esta versión: 112 chunks** en
`brain_documents` (30 manifiesto + 82 docs) — 81 `public` (30 manifiesto + 51
docs), 31 `internal` (todos de `general/*`).

Verificado ejecutando de verdad `node src/index.mjs --sources=manifiesto,docs
--dry-run` contra el bucket real (con `EMBEDDINGS_PROVIDER=mock,
RC_BRAIN_TEST_RUN=1` para no depender de Ollama en esta comprobación de
conteos — la mecánica de lectura/chunking es idéntica con el proveedor real,
solo cambia el vector). Comprobación de codificación en la misma corrida: **9
ficheros escaneados, 0 con mojibake (`U+00C3`) detectado**.

## Qué se probó (evidencia real) y qué queda pendiente

Ollama es inalcanzable desde esta máquina de desarrollo (red interna del
VPS, por diseño). Lo que se pudo probar de verdad contra los sistemas reales
(Postgres vía el mismo endpoint HTTPS que usa producción, y el bucket real
de Storage):

1. **Chunking + lectura sobre contenido real** (ver tabla de arriba).
2. **Mecánica de idempotencia**, con `EMBEDDINGS_PROVIDER=mock` (vectores
   deterministas, NO semánticos, bloqueado salvo `RC_BRAIN_TEST_RUN=1`)
   contra la tabla real, con filas marcadas y borradas al terminar:
   - 1ª ingesta de 2 documentos de prueba → 3 chunks insertados.
   - 2ª ingesta idéntica → sigue en 3 (no 6).
   - 3ª con contenido cambiado → pasa a 2 correctamente.
   - Orden por similitud coseno: el texto exacto de un chunk se recupera en
     top-1 con similitud `1.0`.
3. **Dimensión e índice**, contra la tabla real: `atttypmod` de `embedding` =
   `1024` ✅; con 600 filas de prueba + `ANALYZE`, `EXPLAIN (FORMAT JSON)`
   elige `Index Scan using brain_documents_embedding_ivfflat_idx` por
   decisión propia del planificador. Limpiado por completo al terminar.
4. **Storage real**: bucket privado confirmado (400 sin credenciales, 200 con
   `service_role`), listado de las 4 carpetas y 9 ficheros, descarga y
   decodificación UTF-8 explícita verificada sin mojibake.

**Ya verificado por el orquestador, no por este agente en esta máquina**
(D-010, con acceso real a Ollama en el VPS): las 5 preguntas de control y las
3 fuera-de-corpus contra el manifiesto, con `bge-m3` real, y vecinos por
similitud coseno temáticamente coherentes.

**Pendiente:** las preguntas de control aún no cubren el corpus de
documentos (`ideario`/`marca`/`referencias`/`general`) recién migrado a
Storage — `src/controlQuestions.mjs` solo tiene las 5+3 originales sobre
puntos del manifiesto. Ampliarlo con preguntas sobre el corpus de documentos
es un complemento razonable, no bloqueante para este gate (que pedía
correcto por manifiesto).

## Cómo desplegar y verificar

```bash
# 1. Confirmar el nombre real de la red de Ollama (puede cambiar entre
#    despliegues -- D-010):
docker network ls | grep ollama

# 2. Nada que poblar en el host -- el corpus de documentos ya vive en el
#    bucket privado de Supabase Storage "corpus".

# 3. Desplegar/re-desplegar en Dokploy:
#    Docker Compose -> repo github.com/estudiohz/razoncomun, rama main,
#    ruta: lib/brain/ingest/docker-compose.brain-ingest.yml
#    Variables: SUPABASE_PUBLIC_URL, SERVICE_ROLE_KEY (copiar de "rc-supabase",
#    D-004), OLLAMA_INTERNAL_NETWORK si el paso 1 dio un nombre distinto.

# 4. `brain-ingest` corre e ingiere; `brain-control` arranca solo cuando
#    `brain-ingest` terminó bien y verifica las preguntas de control contra
#    Ollama real, saliendo con código 1 si algo falla. Ver logs en Dokploy.

# 5. Confirmar el conteo real:
curl -sS -X POST "https://dev-api.razoncomun.com/pg/query" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"select source, visibility, count(*) from brain_documents group by 1,2 order by 1,2;"}'
# Esperado: manifiesto/public=30, estudio/public=51, estudio/internal=31 (total 112)
```

## Variables de entorno

Ver `.env.example` (documentado línea a línea). Nunca commitear `.env` real
— el `SERVICE_ROLE_KEY` bypassa RLS sobre toda la base de datos, no solo
`brain_documents`.

## Re-ejecución (mantenimiento normal)

Volver a lanzar el servicio en Dokploy es siempre seguro: cada documento se
identifica por su clave de idempotencia (`point_id` para el manifiesto,
`file` para los docs de Storage, `entry_id` para la wiki de conocimiento) y
se borra-e-inserta entero, así que un cambio en el manifiesto, el bucket o la
wiki se refleja sin duplicados ni basura de la versión anterior. Cuando
existan `articles` (blog, Ola 3 con rc-05) y `decisions`/`opinions`, extender
con nuevos conectores en `src/connectors/` siguiendo la misma forma
(`{ source, refId, visibility, idempotencyKey, chunks }`) que ya usan
`manifesto.mjs`, `corpusStorage.mjs` y `brainEntries.mjs`.

## Wiki de conocimiento (`brain_entries` -> `source='conocimiento'`)

`src/connectors/brainEntries.mjs` indexa `public.brain_entries` (migración
`0024_brain_wiki.sql`) -- la wiki editable por el equipo (admin/editor) desde
el panel, pensada literalmente "como artículos": título + cuerpo markdown +
categoría propia (`brain_categories`) + área temática opcional
(`public.categories`, el mismo catálogo de departamentos del blog).

**Comando:**

```bash
# Solo las entradas pendientes (indexed_at IS NULL) -- uso normal/cron:
node src/index.mjs --sources=conocimiento

# Reindexado COMPLETO (todas las entradas, hayan cambiado o no) -- tras
# cambiar CHUNK_TARGET_CHARS/CHUNK_OVERLAP_CHARS, o para una primera carga:
node src/index.mjs --sources=conocimiento --all

# Combinable con las otras fuentes en la misma corrida:
node src/index.mjs --sources=manifiesto,docs,conocimiento

# Atajo equivalente (el script antepone --sources=manifiesto,docs pero la
# última bandera --sources= gana, ver parseArgs en index.mjs):
scripts/rc-brain-ingest.sh --sources=conocimiento
```

**Por qué el título va SIEMPRE antepuesto al cuerpo antes de trocear.** El
texto que se pasa a `chunkMarkdown()` es `"# {title}\n\n{body}"`. Como
`chunkMarkdown` trata ese `#` como un encabezado de nivel 1 y antepone el
heading a **cada** chunk que resulta de esa sección (no solo al primero), el
título queda presente en absolutamente todos los chunks de la entrada. Es
decisivo para preguntas ciudadanas tipo FAQ ("¿Qué cuota de autónomos vais a
cobrar?"): la pregunta literal (el título) viaja pegada a cada fragmento de
la respuesta, así que cualquier trozo que se recupere por similitud arrastra
también la pregunta que lo motivó. Para la categoría `preguntas-frecuentes`
(slug de `brain_categories`) se refuerza aún más: el título se repite una
segunda vez como `**Pregunta:** {title}` justo debajo del heading.

**Visibilidad:** se hereda literalmente de `brain_entries.visibility`
(`internal`/`public`) -- **no se reinterpreta ni se degrada nunca a
`public`**. Es el punto crítico de seguridad de este connector (I3,
`revision-seguridad.md`): una entrada `internal` en la wiki debe seguir
siendo invisible para el endpoint de chat público, exactamente igual que el
resto del corpus.

**Metadata por chunk:** `entry_id`, `title`, `category` (slug de
`brain_categories`), `area` (nombre de `public.categories` si `area_id` no es
null), `origin` (`manual`/`proposal`), `chunk_index`, `chunk_count`. Guardar
`category`/`area` aquí deja el terreno preparado para una recuperación
*topic-aware* futura (filtrar/ponderar por departamento antes de la
similitud), aunque hoy `retrieval.mjs` no lo usa todavía.

**`indexed_at`:** el job solo lo marca (`update brain_entries set indexed_at
= now()`) **después** de insertar con éxito los chunks de esa entrada
concreta (ver el gancho `onIndexed` en `ingest.mjs`) -- si el INSERT fallara
a medias, la entrada sigue marcada como pendiente para el siguiente intento,
nunca se da por indexada una entrada a medio escribir.

**Salvaguarda anti-corrupción (D-009), por ENTRADA, no por corrida entera:**
igual que `corpusStorage.mjs`, se escanea el texto en busca de `U+FFFD`
(carácter de reemplazo) y `U+00C3` "Ã" (huella de doble codificación UTF-8).
A diferencia de `corpusStorage.mjs` (que aborta toda la ingesta si aparece),
aquí solo se descarta la entrada afectada -- se registra un aviso, no se
indexa, no se marca `indexed_at`, y el resto de la wiki se ingiere con
normalidad. Verificado con una entrada de prueba con "Ã" en el título y el
cuerpo: se saltó sola, sin tocar las otras dos entradas de la misma corrida
ni detener el proceso.

**Verificación end-to-end real (esta sesión, limpiada al terminar):** 2
entradas de prueba (`brain_entries` estaba vacía) -- una FAQ pública ("¿Qué
cuota de autónomos vais a cobrar?", categoría `preguntas-frecuentes`, área
Autónomos) y una nota interna ("Criterios internos para gestionar el despido
de un trabajador", `visibility='internal'`, área Empleo) -- contra el
Postgres real (`dev-api.razoncomun.com`), con `EMBEDDINGS_PROVIDER=mock`
(Ollama no es alcanzable desde esta máquina de desarrollo, igual que en las
verificaciones previas de este mismo job -- ver más abajo qué queda
pendiente de Ollama real):

1. Primera corrida (`--sources=conocimiento`, modo pendientes): 2 entradas ->
   7 chunks (4 FAQ + 3 nota interna), `ref_id` = id real de cada entrada,
   `visibility` heredada correctamente (`public`/`internal`), `metadata`
   con `title`/`category`/`area`/`entry_id` correctos, título presente en
   los 4 chunks de la FAQ. `indexed_at` quedó seteado en ambas.
2. Segunda corrida (modo pendientes, sin cambios): 0 entradas encontradas --
   no reprocesa lo ya indexado.
3. Tercera corrida (`--all`): reindexa las 2 igual, borra 7 e inserta 7 --
   sin duplicar.
4. Edité el `body` de la FAQ directamente en Postgres: el trigger
   `brain_entries_reset_indexed_at` puso su `indexed_at=NULL`
   automáticamente (la nota interna, sin tocar, conservó su `indexed_at`).
   Corrida en modo pendientes: encontró **solo** la FAQ editada (1 entrada),
   borró sus 4 chunks viejos e insertó 5 nuevos -- la nota interna no se
   reprocesó (siguió con sus 3 chunks intactos).
5. Entrada de prueba con mojibake ("Ã") en título y cuerpo: se saltó con
   aviso claro, 0 chunks insertados, `indexed_at` quedó `NULL`.
6. Recuperación (`lib/brain/service/src/retrieval.mjs`, con el mismo
   `EMBEDDINGS_PROVIDER=mock`): consultando con el **texto exacto** del
   chunk 0 de la FAQ (necesario porque el mock no es semántico, solo
   determinista por texto exacto -- misma limitación ya declarada para el
   resto del corpus), `retrieve(text, {visibility:'public'})` devolvió la FAQ
   en **top-1 con similitud 1.0**, `source='conocimiento'`. La misma consulta
   con `visibility: null` (canal interno) SÍ incluyó el chunk `internal` de
   la nota de despido. Comprobación adversaria: consultando con
   `visibility:'public'` usando el título/texto de la nota **interna**, cero
   filas `internal` aparecieron en el resultado -- el filtro de visibilidad
   de `retrieval.mjs` no tuvo que cambiarse porque ya filtra correctamente
   (ver hallazgo más abajo).
7. Limpieza: las 3 entradas de prueba y sus 8 chunks se borraron al terminar;
   `brain_entries` volvió a 0 filas y los totales de `brain_documents` por
   `source`/`visibility` volvieron exactamente a los 112 de antes (30
   manifiesto + 51 estudio-public + 31 estudio-internal), 0 en
   `source='conocimiento'`.

**Pendiente (declarado, no verificado en esta sesión):** todo lo anterior
usa `EMBEDDINGS_PROVIDER=mock` porque Ollama no es alcanzable desde esta
máquina (red interna del VPS, igual que en las verificaciones previas de
manifiesto/docs). No se ha comprobado que una pregunta ciudadana
**parafraseada** (no el texto exacto) recupere semánticamente bien la FAQ
correcta con `bge-m3` real -- eso requiere correr esto en el VPS o con acceso
a Ollama real, igual que quedó pendiente para el corpus de `docs/`.

## Hallazgo sobre `lib/brain/service/src/retrieval.mjs` (recuperación)

`retrieve()` **no filtra por `source` en absoluto** -- la query es
`select ... from brain_documents where true <cláusula de visibilidad>`, sin
ninguna condición sobre `source`. Eso significa que el nuevo
`source='conocimiento'` se recupera automáticamente por similitud en cuanto
hay filas, tanto en el chat público (`visibility:'public'`, con el filtro
`and visibility = 'public'`) como en el canal interno (`visibility: null`,
sin cláusula -- todo el corpus). **No hizo falta tocar `retrieval.mjs`**: ya
estaba escrito de forma agnóstica a `source`, y la verificación end-to-end de
arriba lo confirma con datos reales (la FAQ de prueba apareció en la consulta
pública sin ningún cambio en este fichero). Tampoco se tocó el filtro de
visibilidad (I3) ni el guardrail anti-inyección (I4, `injectionGuard.mjs`,
que no se llegó a rozar en este trabajo).
