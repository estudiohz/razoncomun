-- 0001_extensions.sql
-- Extensiones necesarias y utilidades genéricas compartidas por el resto del esquema.
-- NOTA: vector, pgcrypto, uuid-ossp y pg_trgm ya se habilitan a nivel de infraestructura
-- (infra/supabase/volumes/db/00-extensions.sql). Se repiten aquí de forma idempotente
-- para que este directorio de migraciones sea aplicable de forma autocontenida contra
-- cualquier Postgres 15+ limpio (ver supabase/README.md).

begin;

create extension if not exists "uuid-ossp"   with schema extensions;
create extension if not exists "pgcrypto"    with schema extensions;
-- pg_trgm y vector: SIN "with schema extensions" a propósito. En el Supabase self-hosted
-- ya desplegado (infra/supabase/volumes/db/00-extensions.sql) ambas quedan instaladas en
-- el esquema "public" (verificado en vivo: pg_extension.extnamespace = public). Forzar aquí
-- "extensions" chocaría con esa instalación previa (CREATE EXTENSION IF NOT EXISTS no mueve
-- una extensión ya instalada de esquema) y dejaría el tipo `vector`/opclass `gin_trgm_ops`
-- inalcanzable sin qualificar. Se instalan sin esquema explícito: en una base limpia caen en
-- "public" (primer esquema no-$user del search_path), igual que en el entorno real. El resto
-- de este directorio de migraciones asume por tanto `vector(...)`/`gin_trgm_ops` SIN
-- prefijo de esquema, y `extensions.gen_random_uuid()` / `extensions.uuid_generate_v4()`
-- SIEMPRE con prefijo, porque esas sí viven confirmadamente en el esquema "extensions".
create extension if not exists "pg_trgm";
create extension if not exists "vector";

-- Función genérica para columnas updated_at: se reutiliza en todas las tablas que la lleven.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger genérico BEFORE UPDATE: mantiene la columna updated_at al día.';

commit;
