-- 0083 · Plantilla por página del CMS
-- Cada página puede elegir una plantilla de diseño propia (componente React
-- registrado en apps/web/src/components/paginas/plantillas). 'estandar' =
-- título + cuerpo, el comportamiento de siempre. Si el código no conoce la
-- clave, la ruta pública cae a 'estandar' (nunca rompe).
alter table public.pages
  add column if not exists template text not null default 'estandar';

alter table public.pages
  drop constraint if exists pages_template_formato;
alter table public.pages
  add constraint pages_template_formato check (template ~ '^[a-z0-9-]{1,40}$');
