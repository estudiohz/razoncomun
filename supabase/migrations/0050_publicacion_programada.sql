-- 0050_publicacion_programada.sql
--
-- Publicación programada de artículos, al estilo de WordPress: se elige fecha
-- y hora y el artículo aparece solo cuando llega el momento.
--
-- DECISIÓN DE DISEÑO: no hay tarea programada ni cron.
--
-- Un artículo programado es simplemente `status='published'` con `published_at`
-- en el futuro, y la VISIBILIDAD la decide la propia política RLS comparando
-- con `now()`. Alternativa descartada: dejarlo en 'draft' y que un cron lo
-- publique a su hora — eso añade una pieza que puede fallar en silencio (y si
-- falla, el artículo simplemente no sale y nadie se entera hasta que alguien
-- lo busca). Aquí no hay nada que pueda fallar: o ya es la hora, o no lo es.
--
-- POR QUÉ EN RLS Y NO SOLO EN LAS CONSULTAS: la política anterior era
-- `status = 'published' OR is_editor()`. Con ella, un artículo programado sería
-- legible por CUALQUIERA a través del API REST desde el momento de guardarlo,
-- aunque la web no lo listara. La fecha de publicación tiene que ser una regla
-- de la base de datos, no una cortesía de la interfaz.
--
-- Comprobado antes de aplicar: 0 artículos publicados con `published_at` nulo,
-- así que añadir la condición no oculta nada de lo que ya estaba publicado.
-- `guardarArticulo` sella `published_at` en la transición a publicado, de modo
-- que la columna nunca queda nula en un artículo publicado.

drop policy if exists articles_select_published_or_team on public.articles;

create policy articles_select_published_or_team on public.articles
  for select
  using (
    (
      status = 'published'
      and published_at is not null
      and published_at <= now()
    )
    or is_editor()
  );

comment on column public.articles.published_at is
  'Fecha de publicacion. Si esta en el FUTURO el articulo esta PROGRAMADO: la politica RLS lo oculta al publico hasta que llega la hora. Ver migracion 0050.';
