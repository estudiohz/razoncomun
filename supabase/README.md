# supabase/

Esqueleto para el trabajo de **rc-02-datos** (Ola 1) y sucesivos. Zona propia de ese agente — nadie más toca el esquema (ver `docs/tecnico/revision-seguridad.md`, hallazgo C3, y `docs/tecnico/plan-lanzamiento.md`, Ola 1).

## Estructura prevista

```
supabase/
├── migrations/     # SQL versionado (una migración = un cambio de esquema). Vacío por ahora.
├── seeds/          # Datos semilla: territorios (50 provincias + Ceuta/Melilla + 17+2 CCAA),
│                   # puntos del manifiesto, etc. Vacío por ahora. NUNCA datos reales de personas
│                   # (revision-seguridad.md, C5 — repo público).
└── README.md       # este archivo
```

## Qué NO vive aquí

- El propio motor de Postgres: eso es `infra/docker-compose.supabase.yml` (rc-01-infra).
- Las credenciales de conexión: viven en `infra/.env` (no versionado) o en la config del servicio en Dokploy.

## Convenciones para rc-02-datos (referencia, no normativas de este agente)

- RLS activada en TODAS las tablas expuestas por PostgREST — PostgREST publica todo lo que no tenga RLS.
- `vector(1024)` para embeddings (bge-m3, ver `docs/tecnico/revision-seguridad.md` "Decisión cerrada: embeddings del RC-Brain").
- La extensión `vector` y `pg_trgm` ya se habilitan a nivel de infraestructura en el arranque del contenedor `db` (`infra/supabase/volumes/db/00-extensions.sql`) — las migraciones de aplicación no necesitan repetir el `CREATE EXTENSION`, pero pueden hacerlo de forma idempotente (`IF NOT EXISTS`) sin que rompa nada.

## Estado (Ola 1, rc-02-datos)

Esquema completo aplicado y verificado en limpio contra el Supabase de desarrollo
(`dev-api.razoncomun.com`): 15 migraciones (`0001`...`0015`), 40 tablas, RLS activada al
100% (0 tablas sin RLS), índice `ivfflat` sobre `brain_documents.embedding`, seeds de
territorio/manifiesto/categorías/roles cargados, y batería de pruebas RLS con evidencia
real (aciertos y rechazos) documentada en el informe de cierre de ola. Detalle de
desviaciones declaradas respecto a `docs/tecnico/modelo-datos.md` (p. ej. `proposal_supports`,
ambigüedad de `ballots.weight`): ver comentarios al principio de cada archivo de migración
afectado y el informe de la Ola 1.

## Estado (fuera de ola, rc-02-datos — D-016)

**0016_ai_provider_credentials.sql** y **0017_manifesto_versions_dedupe.sql**, aplicadas y
verificadas en vivo contra `dev-api.razoncomun.com` sobre el esquema ya desplegado de la Ola 1
(migración aditiva, sin tocar tablas existentes):

- `ai_provider_credentials`: claves de los proveedores de IA (Anthropic/OpenAI/Google) cifradas
  con `pgcrypto` (`pgp_sym_encrypt`/`pgp_sym_decrypt`), clave maestra **recibida siempre como
  parámetro desde el entorno de la app, nunca almacenada en la base**. Índice único parcial
  `(active) WHERE active` garantiza un solo proveedor activo a nivel de esquema. RLS activada
  sin policies (como `brain_documents`, 0012) + `REVOKE` explícito a `anon`/`authenticated` a
  nivel de tabla Y de las funciones `ai_credentials_set`/`ai_credentials_get_active`/
  `ai_credentials_revert` (ver nota en el propio archivo: un `REVOKE ... FROM PUBLIC` no basta
  en este proyecto porque los privilegios por defecto se conceden directamente a `anon` y
  `authenticated`, no vía `PUBLIC` — hay que revocarlos de cada rol explícitamente).
  `ai_credentials_revert` guarda el proveedor anterior (`previous_credential_id`) para que la
  suite de neutralidad (`ai_evals`, 0014) pueda revertir automáticamente si el resultado tras un
  cambio cae por debajo del 95% (D-016).
- `manifesto_point_versions`: purgados los 16 registros duplicados de desarrollo (45→29 filas,
  15 combinaciones `(point_id, version)` repetidas → 0) y añadida `UNIQUE (point_id, version)`
  (deuda D-014).

**Pendiente de decisión de Sergio, NO implementado:** NIF/DNI de afiliados en `profiles` — ver
el informe de cierre de esta tarea (o `decisiones-construccion.md`) para la propuesta de diseño.

## Cómo aplicar las migraciones

Cada archivo de `migrations/*.sql` está envuelto en `begin; ... commit;` y es idempotente
donde tiene sentido (`create extension if not exists`, `on conflict do nothing` en seeds).
Deben aplicarse **en orden numérico**, seguidos de los seeds y, solo en desarrollo, de
`seeds/test-data/`.

### Opción A — Supabase CLI (recomendada si el proyecto usa `supabase link`)

```bash
supabase link --project-ref <ref-o-host-del-proyecto>
supabase db push          # aplica todo lo que falte en migrations/, en orden
```

Si el proyecto no usa aún migraciones gestionadas por la CLI (es este caso: son SQL planas,
no el formato de `supabase migration new`), usa la Opción B o C.

### Opción B — psql directo (requiere `DATABASE_URL`, nunca commitear el valor real)

```bash
# DATABASE_URL apunta al Postgres del proyecto (ver infra/.env, no versionado)
for f in supabase/migrations/*.sql; do
  echo "== $f =="
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f" || break
done

for f in supabase/seeds/*.sql; do
  [ -f "$f" ] && psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done

# SOLO en desarrollo/QA, nunca en producción:
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/seeds/test-data/9001_fixtures.sql
```

### Opción C — Postgres no expuesto directamente (Kong → postgres-meta)

Cuando, como en el Supabase self-hosted actual, Postgres no tiene el puerto publicado y solo
hay acceso vía Kong, se puede ejecutar SQL arbitrario contra `POST {SUPABASE_PUBLIC_URL}/pg/query`
con la `service_role` key (headers `apikey` y `Authorization: Bearer <service_role>`, body
`{"query": "<SQL>"}`). Es el método usado por rc-02-datos para verificar en vivo que las
migraciones aplican en limpio. La `service_role` key **nunca** va en el repo: vive en el
entorno local o en la config del servicio en Dokploy.

> ### ⚠️ OBLIGATORIO al usar la Opción C: declarar UTF-8
>
> **Este método corrompió silenciosamente los seeds la primera vez que se aplicaron**
> (20/07/2026, ver D-009 en `docs/tecnico/decisiones-construccion.md`). El manifiesto y
> los nombres de provincias quedaron con doble codificación: `Córdoba` → `CÃ³rdoba`,
> `Ecuación` → `EcuaciÃ³n`. **Los archivos `.sql` en disco estaban correctos**: el daño
> se produjo en el transporte HTTP.
>
> Nada falla de forma visible: la petición devuelve 200, los conteos cuadran y el gate
> parece verde. Solo se detecta mirando el contenido real.
>
> Al enviar SQL por HTTP hay que **codificar el cuerpo explícitamente en UTF-8 y
> declararlo en la cabecera**:
>
> ```python
> body = json.dumps({"query": sql}).encode("utf-8")   # <- explicito
> req.add_header("content-type", "application/json; charset=utf-8")
> req.add_header("content-length", str(len(body)))    # longitud en BYTES, no en chars
> ```
>
> Con `curl`, evitar `-d` con texto acentuado desde shells de Windows: usar
> `--data-binary @archivo.json` con el archivo guardado en UTF-8.
>
> **Comprobación obligatoria tras aplicar cualquier seed con acentos** (debe devolver 0):
>
> ```sql
> select count(*) from territories      where name  like '%' || U&'\00C3' || '%';
> select count(*) from manifesto_points where title like '%' || U&'\00C3' || '%'
>                                          or body like '%' || U&'\00C3' || '%';
> ```
>
> `U+00C3` (`Ã`) no aparece en español correcto: si hay filas, la carga se corrompió.
> Ojo: si el daño incluye `U+FFFD` (`�`) la pérdida es **irreversible** y hay que
> recargar desde el `.sql`, no reconvertir.
>
> #### ⚠️ Buscar TRES patrones, no solo `Ã` (lección de la Ola 4)
>
> El barrido inicial solo buscaba `Ã` (chr 195) — mojibake de vocales acentuadas
> por doble codificación UTF-8→Latin1. **rc-10 encontró dos patrones más que ese
> barrido declaraba "limpios":**
>
> - **`chr(226)` (`â`)** — el símbolo `€` (bytes `E2 82 AC`) decodificado como
>   CP1252 se convierte en `â‚¬`. Apareció en el punto 17 del manifiesto
>   (`~16.000€`), su versión pública y el corpus del cerebro. **Reparación
>   quirúrgica** (`replace(col, chr(226)||chr(8218)||chr(172), chr(8364))`), NO
>   la conversión global `LATIN1→UTF8`, que rompería los acentos correctos del
>   resto del campo.
> - **`chr(65533)` (`U+FFFD`, `�`)** — carácter de reemplazo, pérdida
>   irreversible. Apareció en `audit_log.meta`: **la ruta del chat corrompió la
>   entrada del usuario** (bug de ruta viva, no dato legacy). Recargar desde
>   origen, no reconvertir.
>
> ```sql
> -- comprobación COMPLETA post-carga (los tres patrones, debe devolver 0):
> select count(*) from manifesto_points
>  where position(chr(195) in body) > 0    -- Ã  (Latin1)
>     or position(chr(226) in body) > 0    -- â‚¬ (CP1252, euro)
>     or position(chr(65533) in body) > 0; -- �  (perdida irreversible)
> ```
>
> Y el barrido debe correr con `PYTHONIOENCODING=utf-8` / `python -X utf8`: el
> detector original **crasheaba** al imprimir las filas con `U+FFFD` (la
> herramienta fallaba justo sobre los datos que debía mostrar). Cubrir también
> los catálogos: `pg_description` (COMMENT ON), `pg_proc.prosrc` (cuerpos de
> función), `pg_constraint`, `pg_policies`.

### Reaplicar en limpio (drop y recrear, SOLO en un entorno de desarrollo)

```sql
drop trigger if exists on_auth_user_created on auth.users;
drop schema public cascade;
create schema public;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
```

Después, aplicar `migrations/*.sql` en orden, luego `seeds/*.sql`, y opcionalmente
`seeds/test-data/9001_fixtures.sql`.
