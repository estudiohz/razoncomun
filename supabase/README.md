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
