-- 0026_brain_entries_charts.sql
-- Gráficos/tablas adjuntos a una entrada de la wiki del cerebro (brain_entries, 0024).
--
-- AUTORÍA HUMANA: el editor rellena los datos (etiqueta/valor) en /admin/cerebro
-- y el chat los muestra al recuperar esa entrada. Los NÚMEROS los pone la persona,
-- NUNCA la IA -- coherente con "datos contrastados": la IA solo redacta el texto,
-- jamás inventa las cifras de un gráfico.
--
-- Forma de cada elemento del array `charts` (se valida en la app, no en la BD,
-- para no acoplar el esquema a la forma exacta del spec):
--   { "type": "bar"|"table", "title": string, "unit"?: string, "note"?: string,
--     "data": [ { "label": string, "value": number }, ... ] }
--
-- NO se embebe en brain_documents: es metadato de PRESENTACIÓN, no texto para
-- buscar. El connector de ingesta lo ignora; el chat lo lee aparte de
-- brain_entries por el ref_id de los chunks recuperados. Por eso tampoco entra
-- en el trigger brain_entries_reset_indexed_at (que solo mira body/visibility):
-- cambiar un gráfico no obliga a reindexar embeddings.

begin;

alter table public.brain_entries
  add column if not exists charts jsonb not null default '[]'::jsonb;

comment on column public.brain_entries.charts is
  'Array de specs de gráficos/tablas (bar|table) adjuntos a la entrada, rellenados a mano por el editor en /admin/cerebro. Presentación pura, no se embebe. El chat los muestra al recuperar la entrada. Los datos numéricos son de autoría humana, nunca de la IA (datos contrastados).';

commit;
