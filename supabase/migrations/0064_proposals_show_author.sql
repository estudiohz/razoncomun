-- 0064 · La ficha de la propuesta puede mostrar su autor, solo si éste lo decide.
--
-- Una propuesta política con nombre es una opinión política atribuida a una
-- persona (RGPD art. 9): por eso el nombre NO se publica por defecto. El socio
-- marca "Publicar con mi nombre" al proponer; el admin puede activarlo después
-- en las que ya existen (p. ej. las del equipo). Sin marcar, la ficha dice
-- "Propuesta de un socio" ("Razón Común" si la creó el RC-bot).

alter table public.proposals
  add column show_author boolean not null default false;

comment on column public.proposals.show_author is
  'true = la ficha pública muestra el display_name del autor. Por defecto false (RGPD art. 9). Tras una baja, display_name pasa a "Usuario dado de baja" (0055).';
