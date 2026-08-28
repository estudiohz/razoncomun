-- 0051_articulo_opinion.sql
--
-- Marca de "artículo de opinión".
--
-- POR QUÉ NO SE QUITA SIN MÁS LA EXIGENCIA DE FUENTES: publicar exigía al menos
-- una fuente, y eso es deliberado — el sello de trazabilidad es la marca de la
-- casa ("Razón Común se basa en datos", CLAUDE.md). Quitar la regla para todos
-- los artículos habría resuelto el caso de Sergio a costa de perder la garantía
-- en los articulos que SÍ deben citar.
--
-- Con esta marca la regla se mantiene donde importa: un artículo de análisis
-- sigue sin poder publicarse sin fuentes; uno de opinión, firmado y propio, sí.
-- Y queda registrado en la fila, no solo en la cabeza de quien lo escribió, así
-- que la web puede distinguirlos (por ejemplo, etiquetándolos como opinión).

alter table public.articles
  add column if not exists is_opinion boolean not null default false;

comment on column public.articles.is_opinion is
  'Articulo de opinion: contenido propio, sin fuentes externas. Exime del requisito de citar fuentes al publicar (ver guardarArticulo). Los articulos de datos SIGUEN exigiendolas.';
