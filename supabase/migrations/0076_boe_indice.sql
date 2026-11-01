-- 0076 · Auditoría — índice diario del BOE (contratos y otras disposiciones).
--
-- El BOE no tiene buscador por API: solo el sumario de cada día. Un job
-- diario (/api/auditoria/indexar-boe, schedule de Dokploy) guarda en
-- `boe_items` (0015) las secciones V-A (contratación del sector público) y
-- III (otras disposiciones: convenios, subvenciones…) para poder buscarlas
-- desde un caso. Se añade el órgano, el expediente y el enlace al XML.

begin;

alter table public.boe_items
  add column departamento    text,
  add column expediente      text,
  add column seccion_codigo  text,
  add column url_xml         text;

create index boe_items_expediente_idx on public.boe_items (expediente) where expediente is not null;
create index boe_items_seccion_fecha_idx on public.boe_items (seccion_codigo, published_date desc);
create index if not exists boe_items_title_trgm on public.boe_items using gin (title gin_trgm_ops);

commit;
