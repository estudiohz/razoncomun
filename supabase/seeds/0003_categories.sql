-- 0003_categories.sql
-- Categorías del blog = áreas temáticas del programa (CLAUDE.md) + Observatorio.
-- Colores: paleta de marca (docs/marca/identidad-visual.md). Regla de marca aplicada:
-- "cada área del programa adopta un color del aro" — Economía=teal e Igualdad=morado se
-- respetan literalmente porque el propio documento de marca los cita como ejemplo
-- ("Economía teal, Vivienda naranja, Transparencia morado…"; morado es además la
-- referencia deliberada a mujer/igualdad). El resto se reparte cíclicamente entre los
-- 5 acentos del aro — NUNCA azul como color dominante de página (regla cromática 1),
-- aquí se usa solo como etiqueta puntual de categoría.

begin;

insert into public.categories (slug, name, color) values
  ('agricultura-ganaderia', 'Agricultura y Ganadería', '#2BC7E8'), -- cian
  ('autonomos',             'Autónomos',                '#C3369E'), -- magenta
  ('economia',              'Economía',                 '#16B8A0'), -- teal (ejemplo explícito de la marca)
  ('educacion',             'Educación',                '#1B3D9C'), -- azul
  ('gasto-publico',         'Gasto Público',             '#E8792F'), -- naranja
  ('industria',             'Industria',                 '#2BC7E8'), -- cian
  ('igualdad',              'Igualdad',                  '#8B30D9'), -- morado (referencia mujer/igualdad)
  ('justicia',              'Justicia',                  '#1B3D9C'), -- azul
  ('sanidad',               'Sanidad',                   '#C3369E'), -- magenta
  ('transportes',           'Transportes',               '#16B8A0'), -- teal
  ('vivienda',              'Vivienda',                  '#E8792F'), -- naranja (ejemplo explícito de la marca)
  ('observatorio',          'Observatorio',              '#8B30D9'); -- morado

commit;
