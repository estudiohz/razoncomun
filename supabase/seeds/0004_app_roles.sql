-- 0004_app_roles.sql
-- Catálogo de roles funcionales de la app (ortogonal a lo orgánico). modelo-datos.md los
-- lista explícitamente como "admin|editor". NOTA: "moderator" NO se seedea aquí a propósito
-- — es un cargo orgánico (positions.role='moderator', scope='community'), no un app_role
-- (ver comentario en migrations/0003_identity.sql, función is_moderator()).

begin;

insert into public.app_roles (key, label) values
  ('admin',  'Administrador'),
  ('editor', 'Editor de blog');

commit;
