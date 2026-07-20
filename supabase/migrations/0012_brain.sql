-- 0012_brain.sql
-- RC-Brain: brain_documents (RAG con pgvector, bge-m3/1024 dims). Acceso SOLO rol servicio
-- (ni siquiera authenticated): el filtro visibility='public' para el chat público lo aplica
-- el backend en la query (I3), no RLS — porque RLS no distingue "chat público" de "consulta
-- directa a la tabla"; aquí se cierra la tabla entera a clientes y todo pasa por server-side
-- con service_role, que es justo lo que pide modelo-datos.md ("rol servicio | rol servicio").

begin;

create table public.brain_documents (
  id          uuid primary key default extensions.gen_random_uuid(),
  source      text not null check (source in ('manifiesto', 'estatutos', 'blog', 'decision', 'opinion', 'video', 'estudio')),
  ref_id      uuid null,                          -- enlace a la fila origen si aplica
  chunk       text not null,                       -- fragmento indexado
  embedding   vector(1024) not null,               -- bge-m3 local vía Ollama
  visibility  text not null default 'internal' check (visibility in ('internal', 'public')),
  metadata    jsonb,
  updated_at  timestamptz not null default now()
);

comment on table public.brain_documents is 'Corpus del RC-Brain. visibility=public es lo único que el endpoint de chat público puede consultar (filtro obligatorio en la query del backend, I3).';

create trigger brain_documents_set_updated_at
  before update on public.brain_documents
  for each row execute function public.set_updated_at();

-- Índice ivfflat para búsqueda por similitud coseno (bge-m3 produce embeddings normalizados).
create index brain_documents_embedding_ivfflat_idx
  on public.brain_documents
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index brain_documents_visibility_idx on public.brain_documents(visibility);
create index brain_documents_source_idx on public.brain_documents(source);

alter table public.brain_documents enable row level security;

-- Sin políticas para anon/authenticated: acceso exclusivo de service_role (bypassa RLS).
-- No se añade ninguna policy a propósito -> RLS deniega todo a anon/authenticated.

commit;
