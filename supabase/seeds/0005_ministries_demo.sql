-- Datos de ejemplo ilustrativos para el simulador de presupuesto (rc-06-participacion).
-- Órdenes de magnitud aproximados a partidas reales del PGE (no cifras oficiales exactas;
-- sync real desde el PGE vía n8n queda pendiente, ver comentario de ministries.current_budget_cents).
insert into public.ministries (name, current_budget_cents, note) values
  ('Sanidad', 2100000000000, 'Paga la atención primaria, hospitales públicos, listas de espera y compra centralizada de medicamentos.'),
  ('Educación y Formación Profesional', 1450000000000, 'Financia becas, centros públicos, FP dual y programas de refuerzo educativo.'),
  ('Trabajo y Economía Social', 3850000000000, 'Cubre prestaciones por desempleo, políticas activas de empleo y subsidios.'),
  ('Inclusión, Seguridad Social y Migraciones', 19800000000000, 'Paga las pensiones contributivas y no contributivas de todo el país.'),
  ('Defensa', 1260000000000, 'Personal militar, mantenimiento de flota y compromisos OTAN.'),
  ('Interior', 950000000000, 'Cuerpos y fuerzas de seguridad del Estado, instituciones penitenciarias y protección civil.'),
  ('Transportes y Movilidad Sostenible', 880000000000, 'Cercanías, AVE, carreteras estatales y subvenciones al transporte público.'),
  ('Vivienda y Agenda Urbana', 320000000000, 'Ayudas al alquiler, plan de vivienda pública y rehabilitación energética.'),
  ('Justicia', 210000000000, 'Juzgados, fiscalía, registro civil y justicia gratuita.'),
  ('Agricultura, Pesca y Alimentación', 780000000000, 'Ayudas PAC, seguros agrarios y modernización de regadíos.'),
  ('Industria y Turismo', 410000000000, 'Planes de digitalización industrial, promoción turística y ayudas a autónomos del sector.'),
  ('Ciencia, Innovación y Universidades', 390000000000, 'Financia investigación pública, becas de doctorado y transferencia tecnológica.')
on conflict do nothing;
