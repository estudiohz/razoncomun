-- 0027_brain_entry_embed.sql
-- Simulador HTML adjunto a una entrada de la wiki del cerebro (brain_entries, 0024).
--
-- El editor (admin) sube desde /admin/cerebro un HTML autocontenido (p. ej. un
-- simulador interactivo) que se guarda aquí VERBATIM. Se sirve al ciudadano en un
-- <iframe sandbox="allow-scripts"> (SIN allow-same-origin) con CSP estricta a
-- través de /api/cerebro/embed/[id] -- origen opaco, sin acceso a la sesión ni
-- al DOM de la app. Ver docs/tecnico/cerebro-participativo.md (piezas A y
-- decisiones D-CP-1/2/9).
--
-- NO se indexa en brain_documents ni entra en el RAG: es un "extra" de
-- presentación, no conocimiento que el modelo deba leer. El chat sigue
-- respondiendo solo con body/charts (texto); si la entrada recuperada tiene
-- embed_html, el front ofrece un botón "¿Quieres ver el simulador?". Por eso
-- tampoco entra en el trigger brain_entries_reset_indexed_at (que solo mira
-- body/visibility): cambiar el simulador no obliga a reindexar embeddings.

begin;

alter table public.brain_entries
  add column if not exists embed_html  text,
  add column if not exists embed_title text;

comment on column public.brain_entries.embed_html is
  'HTML autocontenido (simulador interactivo) subido por el admin en /admin/cerebro. Se sirve en iframe sandbox con CSP estricta vía /api/cerebro/embed/[id]. NO se indexa en brain_documents ni entra en el RAG. Autoría humana.';
comment on column public.brain_entries.embed_title is
  'Título del botón/simulador que se muestra en el chat (p. ej. "Simulador de viabilidad"). NULL si la entrada no tiene simulador.';

commit;
