-- 0001_territories.sql
-- Seed de territorio: 19 comunidades/ciudades autónomas + 52 provincias con jerarquía.
-- Ceuta y Melilla cuentan doble a propósito (como pide el brief "52 provincias + 19
-- comunidades/ciudades autónomas"): cada una tiene una fila type='community' (son su
-- propia entidad de primer nivel, no pertenecen a ninguna CCAA) Y una fila type='province'
-- cuyo parent_id apunta a esa fila-comunidad homónima. Así: 17 CCAA + Ceuta + Melilla (como
-- comunidad) = 19 filas community; 50 provincias + Ceuta + Melilla (como provincia) = 52
-- filas province. Nunca datos de personas (repo público, C5).

begin;

-- 17 comunidades autónomas + Ceuta y Melilla (ciudades autónomas)
insert into public.territories (type, name) values
  ('community', 'Andalucía'),
  ('community', 'Aragón'),
  ('community', 'Asturias, Principado de'),
  ('community', 'Balears, Illes'),
  ('community', 'Canarias'),
  ('community', 'Cantabria'),
  ('community', 'Castilla-La Mancha'),
  ('community', 'Castilla y León'),
  ('community', 'Cataluña'),
  ('community', 'Comunitat Valenciana'),
  ('community', 'Extremadura'),
  ('community', 'Galicia'),
  ('community', 'Madrid, Comunidad de'),
  ('community', 'Murcia, Región de'),
  ('community', 'Navarra, Comunidad Foral de'),
  ('community', 'País Vasco'),
  ('community', 'Rioja, La'),
  ('community', 'Ceuta'),
  ('community', 'Melilla');

-- 52 provincias (50 + Ceuta + Melilla), código INE en comentario, parent_id resuelto por nombre de comunidad.
insert into public.territories (type, name, parent_id) values
  ('province', 'Araba/Álava',            (select id from public.territories where type='community' and name='País Vasco')),
  ('province', 'Albacete',               (select id from public.territories where type='community' and name='Castilla-La Mancha')),
  ('province', 'Alicante/Alacant',       (select id from public.territories where type='community' and name='Comunitat Valenciana')),
  ('province', 'Almería',                (select id from public.territories where type='community' and name='Andalucía')),
  ('province', 'Ávila',                  (select id from public.territories where type='community' and name='Castilla y León')),
  ('province', 'Badajoz',                (select id from public.territories where type='community' and name='Extremadura')),
  ('province', 'Balears, Illes',         (select id from public.territories where type='community' and name='Balears, Illes')),
  ('province', 'Barcelona',              (select id from public.territories where type='community' and name='Cataluña')),
  ('province', 'Burgos',                 (select id from public.territories where type='community' and name='Castilla y León')),
  ('province', 'Cáceres',                (select id from public.territories where type='community' and name='Extremadura')),
  ('province', 'Cádiz',                  (select id from public.territories where type='community' and name='Andalucía')),
  ('province', 'Castellón/Castelló',     (select id from public.territories where type='community' and name='Comunitat Valenciana')),
  ('province', 'Ciudad Real',            (select id from public.territories where type='community' and name='Castilla-La Mancha')),
  ('province', 'Córdoba',                (select id from public.territories where type='community' and name='Andalucía')),
  ('province', 'Coruña, A',              (select id from public.territories where type='community' and name='Galicia')),
  ('province', 'Cuenca',                 (select id from public.territories where type='community' and name='Castilla-La Mancha')),
  ('province', 'Girona',                 (select id from public.territories where type='community' and name='Cataluña')),
  ('province', 'Granada',                (select id from public.territories where type='community' and name='Andalucía')),
  ('province', 'Guadalajara',            (select id from public.territories where type='community' and name='Castilla-La Mancha')),
  ('province', 'Gipuzkoa',               (select id from public.territories where type='community' and name='País Vasco')),
  ('province', 'Huelva',                 (select id from public.territories where type='community' and name='Andalucía')),
  ('province', 'Huesca',                 (select id from public.territories where type='community' and name='Aragón')),
  ('province', 'Jaén',                   (select id from public.territories where type='community' and name='Andalucía')),
  ('province', 'León',                   (select id from public.territories where type='community' and name='Castilla y León')),
  ('province', 'Lleida',                 (select id from public.territories where type='community' and name='Cataluña')),
  ('province', 'Rioja, La',              (select id from public.territories where type='community' and name='Rioja, La')),
  ('province', 'Lugo',                   (select id from public.territories where type='community' and name='Galicia')),
  ('province', 'Madrid',                 (select id from public.territories where type='community' and name='Madrid, Comunidad de')),
  ('province', 'Málaga',                 (select id from public.territories where type='community' and name='Andalucía')),
  ('province', 'Murcia',                 (select id from public.territories where type='community' and name='Murcia, Región de')),
  ('province', 'Navarra',                (select id from public.territories where type='community' and name='Navarra, Comunidad Foral de')),
  ('province', 'Ourense',                (select id from public.territories where type='community' and name='Galicia')),
  ('province', 'Asturias',               (select id from public.territories where type='community' and name='Asturias, Principado de')),
  ('province', 'Palencia',               (select id from public.territories where type='community' and name='Castilla y León')),
  ('province', 'Palmas, Las',            (select id from public.territories where type='community' and name='Canarias')),
  ('province', 'Pontevedra',             (select id from public.territories where type='community' and name='Galicia')),
  ('province', 'Salamanca',              (select id from public.territories where type='community' and name='Castilla y León')),
  ('province', 'Santa Cruz de Tenerife', (select id from public.territories where type='community' and name='Canarias')),
  ('province', 'Cantabria',              (select id from public.territories where type='community' and name='Cantabria')),
  ('province', 'Segovia',                (select id from public.territories where type='community' and name='Castilla y León')),
  ('province', 'Sevilla',                (select id from public.territories where type='community' and name='Andalucía')),
  ('province', 'Soria',                  (select id from public.territories where type='community' and name='Castilla y León')),
  ('province', 'Tarragona',              (select id from public.territories where type='community' and name='Cataluña')),
  ('province', 'Teruel',                 (select id from public.territories where type='community' and name='Aragón')),
  ('province', 'Toledo',                 (select id from public.territories where type='community' and name='Castilla-La Mancha')),
  ('province', 'Valencia/València',      (select id from public.territories where type='community' and name='Comunitat Valenciana')),
  ('province', 'Valladolid',             (select id from public.territories where type='community' and name='Castilla y León')),
  ('province', 'Bizkaia',                (select id from public.territories where type='community' and name='País Vasco')),
  ('province', 'Zamora',                 (select id from public.territories where type='community' and name='Castilla y León')),
  ('province', 'Zaragoza',               (select id from public.territories where type='community' and name='Aragón')),
  ('province', 'Ceuta',                  (select id from public.territories where type='community' and name='Ceuta')),
  ('province', 'Melilla',                (select id from public.territories where type='community' and name='Melilla'));

commit;
