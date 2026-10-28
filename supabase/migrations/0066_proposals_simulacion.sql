-- 0066 · Simulación con IA (MiroFish) de una propuesta.
--
-- Tras simular una propuesta fuera de la web, el superadmin adjunta el informe
-- (PDF), la fecha en que se simuló y el resultado en 2-3 líneas. La ficha
-- pública muestra entonces la etiqueta "Simulación con IA" y una casilla con
-- el resultado y la descarga del informe. Sin PDF no hay etiqueta.
--
-- La fecha permite avisar de que la simulación es anterior a la última edición
-- de la propuesta. Escribir estas columnas es cosa de admin: lo exige la
-- acción del servidor (is_admin), no solo la interfaz.

alter table public.proposals
  add column simulation_pdf_url text null,
  add column simulation_at date null,
  add column simulation_result text null;

comment on column public.proposals.simulation_pdf_url is
  'URL pública del informe PDF de la simulación con IA. Si existe, la ficha muestra la etiqueta y la casilla.';
comment on column public.proposals.simulation_at is
  'Fecha en que se hizo la simulación. Si updated_at es posterior, la ficha avisa de que se simuló una versión anterior.';
comment on column public.proposals.simulation_result is
  'Resultado de la simulación en 2-3 líneas, visible en la casilla de la ficha.';
