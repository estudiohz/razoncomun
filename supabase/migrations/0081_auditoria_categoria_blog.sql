-- 0081 · Auditoría — categoría del blog/Observatorio de cada caso.
--
-- `categoria` (0069) es el TIPO de gasto (subvención, obras…) y casi siempre
-- sale igual. Para el gráfico «Lo más señalado» y los filtros del Observatorio
-- se usa la misma taxonomía que los artículos (`categories`: Economía,
-- Exteriores…). Se elige en el bloque «Publicación» y, como la foto (0080), no
-- es parte de los hechos: se puede cambiar con el caso publicado.

begin;

alter table public.watchdog_alerts
  add column if not exists category_id integer references public.categories(id) on delete set null;

create index if not exists watchdog_alerts_category_idx on public.watchdog_alerts (category_id) where category_id is not null;

commit;
