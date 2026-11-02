-- 0077 · Newsletter N0 — preferencia de avisos de participación por correo.
--
-- docs/tecnico/newsletter.md (D-N1, D-N3). Es distinta de `newsletter_opt_in`
-- (0003): aquella es la newsletter de novedades, opt-in y desmarcada por
-- defecto. Esta cubre los avisos de participación (encuesta del mes y su
-- recordatorio): se informa al registrarse, viene ACTIVADA y se puede quitar
-- en el panel o con un clic desde cada correo. D-N2: los usuarios que ya
-- existían también la reciben activada (decisión de Sergio, 02/11/2026).

begin;

alter table public.profiles
  add column if not exists avisos_correo     boolean not null default true,
  add column if not exists avisos_correo_at  timestamptz null; -- último cambio (prueba de la baja)

commit;
