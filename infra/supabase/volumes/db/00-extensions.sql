-- Extensiones necesarias para Razón Común, aplicadas al arrancar el contenedor db
-- por primera vez (docker-entrypoint-initdb.d/init-scripts, se ejecuta como superusuario).
--
-- Idempotente: seguro de volver a ejecutar (CREATE EXTENSION IF NOT EXISTS).
-- No sustituye a las migraciones de rc-02-datos (supabase/migrations/): esto solo
-- garantiza que el binario de la extensión esté instalado y disponible antes de
-- que corra cualquier migración de aplicación.
--
-- pgvector: embeddings del RC-Brain (bge-m3, vector(1024)) — ver
-- docs/tecnico/revision-seguridad.md "Decisión cerrada: embeddings del RC-Brain".
-- pg_trgm: búsqueda por similitud de texto (útil para blog/manifiesto/búsquedas).
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
