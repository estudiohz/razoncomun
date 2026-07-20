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
