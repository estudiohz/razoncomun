-- 0030_simulador_demografia.sql
-- Simulador del Presupuesto del País -- Ola S3.0 (rc-02-datos, dueño único del esquema).
-- Arquitectura cerrada: docs/tecnico/simulador-pais.md §9 (D-S11..D-S14, 21/07/2026).
--
-- D-S12: los datos demograficos/profesionales NO son dinero -- son un tipo de pieza
-- nuevo (sim_demografia). area_id null = poblacion de Espana (panel general);
-- area_id no-null = profesionales de un sector (convencion de aplicacion: debe ser
-- una partida RAIZ de sim_partidas, parent_id is null -- NO se fuerza con CHECK
-- porque requeriria una subquery; ver comentarios de tabla/columna abajo).
-- D-S13: sin lado "Razon Comun" aqui -- es informativo, no propuesta.
-- D-S14: sim_partidas.slug para la ruta dinamica /pais/[slug] (D-S11); se rellena
-- desde el admin (rc-06) con slugificar() (lib/blog/markdown.ts) -- esta migracion
-- SOLO añade la columna y su constraint de unicidad, no genera slugs.

begin;

-- ============================================================================
-- sim_demografia
-- ============================================================================

create table public.sim_demografia (
  id                 uuid primary key default extensions.gen_random_uuid(),
  area_id            uuid null references public.sim_partidas(id) on delete cascade,
  nombre             text not null,                  -- "Jubilados", "Tropa y mando"...
  num_personas       bigint not null,
  valor_medio_cents  bigint null,                     -- sueldo/pension media; null si no aplica
  unidad_valor_medio text null,                       -- "€/mes", "€/año"
  fuente             text,
  anio               int not null default 2026,
  publicado          bool not null default false,
  orden              int not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint sim_demografia_num_personas_chk
    check (num_personas >= 0),
  constraint sim_demografia_valor_medio_chk
    check (valor_medio_cents is null or valor_medio_cents >= 0)
);

comment on table public.sim_demografia is
  'D-S12 (docs/tecnico/simulador-pais.md §9): una fila = un segmento de poblacion '
  '(area_id null, panel general /pais) o un tipo de profesional de un sector '
  '(area_id = una partida RAIZ de sim_partidas). Sin lado RC (D-S13): informativo, '
  'no propuesta.';

comment on column public.sim_demografia.area_id is
  'null = poblacion de Espana. No-null = profesionales de ese sector; por '
  'CONVENCION DE APLICACION debe apuntar a una partida RAIZ de sim_partidas '
  '(parent_id is null). NO se fuerza con un CHECK de BD (requeriria subquery); '
  'lo garantiza el admin (rc-06) al elegir el area.';

create index sim_demografia_area_idx on public.sim_demografia(area_id);
create index sim_demografia_publicado_idx on public.sim_demografia(publicado);

create trigger sim_demografia_set_updated_at
  before update on public.sim_demografia
  for each row execute function public.set_updated_at();

-- ============================================================================
-- sim_partidas.slug (D-S11/D-S14): ruta dinamica /pais/[slug] para paginas de area raiz.
-- Se rellena desde el admin con slugificar(); esta migracion NO genera slugs.
-- ============================================================================

alter table public.sim_partidas
  add column slug text unique null;

comment on column public.sim_partidas.slug is
  'D-S14: slug unico para /pais/[slug] (paginas de area). Relevante solo para '
  'partidas RAIZ (parent_id is null); nullable porque no todas las areas '
  'necesitan pagina propia desde el dia 1. Se rellena en el admin (rc-06) con '
  'slugificar() (lib/blog/markdown.ts) -- esta migracion no genera slugs.';

-- Parcial: no penaliza el resto de filas (la inmensa mayoria sin slug).
create index sim_partidas_slug_idx on public.sim_partidas(slug) where slug is not null;

-- ============================================================================
-- RLS (mismo patron EXACTO que sim_parametros/sim_partidas, 0029)
-- ============================================================================

alter table public.sim_demografia enable row level security;

create policy sim_demografia_select_published_or_team
  on public.sim_demografia for select
  to anon, authenticated
  using (publicado = true or public.is_editor());

create policy sim_demografia_write_editor
  on public.sim_demografia for all
  to authenticated
  using (public.is_editor())
  with check (public.is_editor());

-- ============================================================================
-- SEMILLA -- TODA en borrador (publicado=false). Cifras plausibles; donde no hay
-- fuente citable real, "PENDIENTE DE FUENTE -- no publicar" (mismo criterio 0029).
-- area_id de las filas de Defensa = el id REAL de la partida raiz 'Defensa'
-- sembrada en 0029 (a5200000-0000-4000-8000-000000000013), no un id inventado.
-- ============================================================================

-- Población de España (area_id null -- panel general /pais, D-S11 sección "Población de España")
insert into public.sim_demografia
  (id, area_id, nombre, num_personas, valor_medio_cents, unidad_valor_medio, fuente, orden) values
  ('a5300000-0000-4000-8000-000000000001', null, 'Población total de España', 48000000, null, null,
    'INE — Padrón continuo (PENDIENTE DE FUENTE, verificar)', 1),
  ('a5300000-0000-4000-8000-000000000002', null, 'Jubilados', 9500000, 140000, '€/mes',
    'Seguridad Social — pensión media mensual (PENDIENTE DE FUENTE)', 2),
  ('a5300000-0000-4000-8000-000000000003', null, 'Funcionarios', 2700000, 220000, '€/mes',
    'Ministerio de Hacienda y Función Pública — salario medio (PENDIENTE DE FUENTE)', 3),
  ('a5300000-0000-4000-8000-000000000004', null, 'Estudiantes', 8000000, null, null,
    'Ministerio de Educación — matriculación (PENDIENTE DE FUENTE)', 4),
  ('a5300000-0000-4000-8000-000000000005', null, 'Autónomos', 3300000, null, null,
    'Seguridad Social — afiliación RETA (PENDIENTE DE FUENTE)', 5),
  ('a5300000-0000-4000-8000-000000000006', null, 'Niños', 7000000, null, null,
    'INE — Padrón continuo, población 0-14 años (PENDIENTE DE FUENTE)', 6);

-- Profesionales de Defensa (area_id = partida raíz 'Defensa' real, sembrada en 0029)
insert into public.sim_demografia
  (id, area_id, nombre, num_personas, valor_medio_cents, unidad_valor_medio, fuente, orden) values
  ('a5300000-0000-4000-8000-000000000011', 'a5200000-0000-4000-8000-000000000013', 'Tropa y mando',
    120000, 190000, '€/mes', 'Ministerio de Defensa — efectivos (PENDIENTE DE FUENTE)', 1),
  ('a5300000-0000-4000-8000-000000000012', 'a5200000-0000-4000-8000-000000000013', 'Personal civil',
    20000, 210000, '€/mes', 'Ministerio de Defensa — personal civil (PENDIENTE DE FUENTE)', 2);

commit;
