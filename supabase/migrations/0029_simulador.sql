-- 0029_simulador.sql
-- Simulador del Presupuesto del País (rc-06-participacion, Ola S0 -- rc-02-datos).
-- Arquitectura cerrada: docs/tecnico/simulador-pais.md (Fable 5, 21/07/2026).
--
-- Dos piezas (D-S1): sim_parametros (variables reales, con elasticidades D-S2b) y
-- sim_partidas (arbol de dinero, D-S2: las formulas de partidas SOLO referencian
-- parametros, nunca otras partidas). sim_escenarios se crea ya pero no se usa hasta
-- F3/S3 (D-S1/S7): deny-all real, sin politicas.
--
-- Unidades (D-S4): las formulas operan en EUROS; el almacen de partidas es bigint en
-- CENTIMOS. publicado (D-S5) separa borrador/publico: TODA la semilla nace en
-- borrador -- publicar es un acto explicito del equipo con la fuente rellenada.
-- Palancas (D-S9): es_palanca exige min/max. Multi-anio desde ya (D-S10): anio.

begin;

-- ============================================================================
-- sim_parametros
-- ============================================================================

create table public.sim_parametros (
  id            uuid primary key default extensions.gen_random_uuid(),
  clave         text unique not null,             -- slug: 'num_autonomos'
  nombre        text not null,                     -- "Número de autónomos"
  unidad        text,                              -- "personas", "€/año", "€"
  anio          int not null default 2026,
  modo          text not null default 'fijo',      -- D-S2b: 'formula' = derivado (elasticidad)
  formula       text null,                         -- solo si modo='formula'; refs a otras claves
  valor_actual  numeric null,                       -- obligatorio si modo='fijo'
  fuente_actual text,                               -- "Seg. Social, afiliación RETA mar-2026 (enlace)"
  valor_rc      numeric null,                       -- solo si RC proyecta cambiarlo
  nota_rc       text null,
  es_palanca    bool not null default false,        -- una palanca NUNCA es derivada
  palanca_min   numeric null,
  palanca_max   numeric null,
  publicado     bool not null default false,
  orden         int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint sim_parametros_clave_slug_chk
    check (clave ~ '^[a-z][a-z0-9_]*$'),
  constraint sim_parametros_modo_chk
    check (modo in ('fijo', 'formula')),
  -- D-S2b: "un parámetro derivado NO puede ser palanca (las palancas son siempre valores base)".
  constraint sim_parametros_palanca_modo_chk
    check (not es_palanca or modo = 'fijo'),
  -- Obligatorio si modo='fijo' (§2).
  constraint sim_parametros_fijo_valor_chk
    check (modo <> 'fijo' or valor_actual is not null),
  -- Simétrico: un parámetro-fórmula necesita su fórmula (D-S8 valida además en escritura).
  constraint sim_parametros_formula_presente_chk
    check (modo <> 'formula' or formula is not null),
  constraint sim_parametros_formula_len_chk
    check (formula is null or char_length(formula) <= 300),
  -- D-S9: palanca ⇒ min/max obligatorios.
  constraint sim_parametros_palanca_minmax_chk
    check (not es_palanca or (palanca_min is not null and palanca_max is not null)),
  constraint sim_parametros_palanca_orden_chk
    check (palanca_min is null or palanca_max is null or palanca_min <= palanca_max)
);

create index sim_parametros_publicado_idx on public.sim_parametros(publicado);

create trigger sim_parametros_set_updated_at
  before update on public.sim_parametros
  for each row execute function public.set_updated_at();

-- ============================================================================
-- sim_partidas (árbol auto-referenciado: contiene = parent_id, D-S1)
-- ============================================================================

create table public.sim_partidas (
  id                uuid primary key default extensions.gen_random_uuid(),
  parent_id         uuid null references public.sim_partidas(id) on delete restrict,
  tipo              text not null,                 -- heredado conceptualmente del raíz, se guarda en cada fila
  nombre            text not null,
  ambito            text not null default 'estatal',
  anio              int not null default 2026,

  -- lado ACTUAL (oficial)
  actual_modo       text not null default 'fijo',
  actual_cents      bigint null,
  actual_formula    text null,                     -- D-S2: SOLO referencia sim_parametros.clave
  fuente_actual     text,                          -- BOE/PGE/IGAE con referencia concreta

  -- lado RAZÓN COMÚN
  rc_modo           text not null default 'fijo',
  rc_cents          bigint null,
  rc_pct            numeric null,                  -- -15 = "−15% sobre el actual"
  rc_formula        text null,
  justificacion_rc  text,                          -- el POR QUÉ (mensaje político)

  -- vínculos y control
  ministry_id       int null references public.ministries(id),   -- alinea con el simulador ciudadano (0008)
  origen            text not null default 'manual',
  ref_propuesta_id  uuid null references public.proposals(id),   -- F4: propuesta aprobada que la creó
  es_palanca        bool not null default false,
  palanca_min       bigint null,
  palanca_max       bigint null,
  publicado         bool not null default false,
  orden             int not null default 0,
  color             text null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint sim_partidas_tipo_chk
    check (tipo in ('ingreso', 'gasto')),
  constraint sim_partidas_ambito_chk
    check (ambito in ('estatal', 'autonomico', 'local', 'otro')),
  constraint sim_partidas_actual_modo_chk
    check (actual_modo in ('fijo', 'formula')),
  constraint sim_partidas_rc_modo_chk
    check (rc_modo in ('fijo', 'pct_actual', 'formula')),
  constraint sim_partidas_origen_chk
    check (origen in ('manual', 'propuesta')),
  -- Lado actual: consistente con su modo (análogo a sim_parametros).
  constraint sim_partidas_actual_fijo_chk
    check (actual_modo <> 'fijo' or actual_cents is not null),
  constraint sim_partidas_actual_formula_chk
    check (actual_modo <> 'formula' or actual_formula is not null),
  constraint sim_partidas_actual_formula_len_chk
    check (actual_formula is null or char_length(actual_formula) <= 300),
  -- Lado RC: solo exige valor cuando ese modo lo necesita; 'fijo' sin rc_cents
  -- significa "sin override todavía" (el motor hereda el actual, D-S7/rollup.ts).
  constraint sim_partidas_rc_pct_chk
    check (rc_modo <> 'pct_actual' or rc_pct is not null),
  constraint sim_partidas_rc_formula_chk
    check (rc_modo <> 'formula' or rc_formula is not null),
  constraint sim_partidas_rc_formula_len_chk
    check (rc_formula is null or char_length(rc_formula) <= 300),
  -- D-S9: palanca ⇒ min/max obligatorios.
  constraint sim_partidas_palanca_minmax_chk
    check (not es_palanca or (palanca_min is not null and palanca_max is not null)),
  constraint sim_partidas_palanca_orden_chk
    check (palanca_min is null or palanca_max is null or palanca_min <= palanca_max),
  -- Una propuesta que origina la partida solo tiene sentido si origen='propuesta'.
  constraint sim_partidas_origen_ref_chk
    check (ref_propuesta_id is null or origen = 'propuesta')
);

create index sim_partidas_parent_idx on public.sim_partidas(parent_id);
create index sim_partidas_tipo_idx on public.sim_partidas(tipo);
create index sim_partidas_publicado_idx on public.sim_partidas(publicado);
create index sim_partidas_ministry_idx on public.sim_partidas(ministry_id);

create trigger sim_partidas_set_updated_at
  before update on public.sim_partidas
  for each row execute function public.set_updated_at();

-- ============================================================================
-- sim_escenarios (F3 -- se crea ya, NO se usa hasta S3: deny-all real, sin políticas)
-- ============================================================================

create table public.sim_escenarios (
  id          uuid primary key default extensions.gen_random_uuid(),
  nombre      text,
  user_id     uuid null references public.profiles(id),
  datos       jsonb not null,
  created_at  timestamptz not null default now()
);

create index sim_escenarios_user_idx on public.sim_escenarios(user_id);

-- ============================================================================
-- RLS (patrón `articles`, 0010_blog.sql)
-- ============================================================================

alter table public.sim_parametros enable row level security;
alter table public.sim_partidas   enable row level security;
alter table public.sim_escenarios enable row level security;

-- sim_parametros: público solo ve publicado=true; editor/admin ve y gestiona todo.
create policy sim_parametros_select_published_or_team
  on public.sim_parametros for select
  to anon, authenticated
  using (publicado = true or public.is_editor());

create policy sim_parametros_write_editor
  on public.sim_parametros for all
  to authenticated
  using (public.is_editor())
  with check (public.is_editor());

-- sim_partidas: idéntico patrón.
create policy sim_partidas_select_published_or_team
  on public.sim_partidas for select
  to anon, authenticated
  using (publicado = true or public.is_editor());

create policy sim_partidas_write_editor
  on public.sim_partidas for all
  to authenticated
  using (public.is_editor())
  with check (public.is_editor());

-- sim_escenarios: deny-all deliberado (F3/S3). RLS activada, CERO políticas: ni
-- anon ni authenticated pueden leer/escribir. Se abre cuando se diseñe S3.

-- ============================================================================
-- SEMILLA (§6) -- TODA en borrador (publicado=false). Cifras plausibles; donde
-- no hay fuente citable real, "PENDIENTE DE FUENTE -- no publicar". Nada sale a
-- /pais hasta que el equipo publique con la fuente rellenada (D-S5).
-- Céntimos: M€ * 1e8 (D-S4). Ejemplo bandera: la cadena de elasticidad de
-- autónomos (cuota ↓ → nº autónomos ↑ → ingresos), parámetro derivado D-S2b.
-- ============================================================================

-- Parámetros base (fijos)
insert into public.sim_parametros
  (id, clave, nombre, unidad, modo, valor_actual, fuente_actual, valor_rc, nota_rc, es_palanca, palanca_min, palanca_max, orden) values
  ('a5100000-0000-4000-8000-000000000001','cuota_media_autonomo','Cuota media de autónomo','€/año','fijo',3600,'Seguridad Social — cuota media RETA (PENDIENTE DE FUENTE, verificar)',2400,'Cuota media proporcional a ingresos según la propuesta de Razón Común',true,1200,4800,1),
  ('a5100000-0000-4000-8000-000000000002','num_autonomos_base','Número de autónomos (base)','personas','fijo',3300000,'Seguridad Social — afiliación RETA (PENDIENTE DE FUENTE)',null,null,false,null,null,2),
  ('a5100000-0000-4000-8000-000000000004','precio_medio_billete_tren','Precio medio del billete de tren','€','fijo',25,'Renfe / CNMC (PENDIENTE DE FUENTE)',null,null,true,5,50,4),
  ('a5100000-0000-4000-8000-000000000005','num_billetes_tren_anio','Billetes de tren al año','billetes/año','fijo',500000000,'Renfe (PENDIENTE DE FUENTE)',null,null,false,null,null,5);

-- Parámetro DERIVADO (elasticidad, D-S2b): al bajar la cuota, sube el nº de autónomos.
insert into public.sim_parametros
  (id, clave, nombre, unidad, modo, formula, fuente_actual, nota_rc, orden) values
  ('a5100000-0000-4000-8000-000000000003','num_autonomos','Número de autónomos (con elasticidad)','personas','formula','num_autonomos_base * (1 + 0.4 * (2800 - cuota_media_autonomo) / 2800)','Hipótesis de elasticidad RC — PENDIENTE DE FUENTE, no publicar','Al bajar la cuota, más gente se da de alta como autónomo (elasticidad). Hipótesis a respaldar con un estudio antes de publicar.',3);

-- Partidas: dos árboles (ingreso/gasto). UUIDs fijos para las referencias parent_id.
insert into public.sim_partidas
  (id, parent_id, tipo, nombre, actual_modo, actual_cents, actual_formula, fuente_actual, rc_modo, rc_cents, rc_pct, rc_formula, justificacion_rc, es_palanca, palanca_min, palanca_max, orden, color) values
  -- INGRESOS
  ('a5200000-0000-4000-8000-000000000011', null, 'ingreso','Cotizaciones sociales','fijo',15000000000000,null,'Seguridad Social — recaudación por cotizaciones (PENDIENTE DE FUENTE)','fijo',null,null,null,null,false,null,null,1,'#8B30D9'),
  ('a5200000-0000-4000-8000-000000000021','a5200000-0000-4000-8000-000000000011','ingreso','Cotizaciones de autónomos (RETA)','formula',null,'num_autonomos * cuota_media_autonomo','Seguridad Social — RETA (PENDIENTE DE FUENTE)','formula',null,null,'num_autonomos * cuota_media_autonomo','Con la cuota proporcional de RC, más altas de autónomos compensan la menor cuota media (elasticidad).',false,null,null,1,null),
  ('a5200000-0000-4000-8000-000000000012', null, 'ingreso','Impuestos especiales','fijo',2500000000000,null,'AEAT — impuestos especiales (PENDIENTE DE FUENTE)','fijo',null,null,null,null,false,null,null,2,'#E8792F'),
  ('a5200000-0000-4000-8000-000000000022','a5200000-0000-4000-8000-000000000012','ingreso','Tabaco','fijo',900000000000,null,'AEAT — impuesto sobre las labores del tabaco (PENDIENTE DE FUENTE)','fijo',900000000000,null,null,'Palanca de ejemplo: recaudación por el impuesto del tabaco.',true,0,1500000000000,1,null),
  -- GASTOS
  ('a5200000-0000-4000-8000-000000000013', null, 'gasto','Defensa','fijo',1200000000000,null,'PGE 2026, sección 14 (PENDIENTE DE FUENTE)','pct_actual',null,-20,null,'Reequilibrio del −20% en Defensa según la propuesta de Razón Común.',false,null,null,3,'#2BC7E8'),
  ('a5200000-0000-4000-8000-000000000023','a5200000-0000-4000-8000-000000000013','gasto','Personal (tropa y mando)','fijo',600000000000,null,'PGE 2026, sección 14 (PENDIENTE DE FUENTE)','fijo',520000000000,null,null,null,false,null,null,1,null),
  ('a5200000-0000-4000-8000-000000000024','a5200000-0000-4000-8000-000000000013','gasto','Equipamiento','fijo',350000000000,null,'PGE 2026 (PENDIENTE DE FUENTE)','fijo',280000000000,null,null,null,false,null,null,2,null),
  ('a5200000-0000-4000-8000-000000000025','a5200000-0000-4000-8000-000000000013','gasto','Operaciones','fijo',150000000000,null,'PGE 2026 (PENDIENTE DE FUENTE)','fijo',100000000000,null,null,null,false,null,null,3,null),
  ('a5200000-0000-4000-8000-000000000014', null, 'gasto','Pensiones','fijo',19000000000000,null,'Seguridad Social — gasto en pensiones (PENDIENTE DE FUENTE)','fijo',19000000000000,null,null,'Palanca de ejemplo: gasto total en pensiones.',true,15000000000000,25000000000000,4,'#C3369E');

commit;
