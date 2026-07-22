-- 0028_pages.sql
-- Mini-CMS de PÁGINAS estáticas gestionables desde /admin/paginas: legales
-- (privacidad, aviso legal, cookies), estatutos, y cualquier página futura.
-- Cada página elige en qué menús aparece (header / footer / legal) con flags.
--
-- El cuerpo se guarda como HTML (editor WYSIWYG del admin). Se sirve en una
-- ruta pública /[slug]. Autoría humana; solo editores escriben.

begin;

create table public.pages (
  id           uuid primary key default extensions.gen_random_uuid(),
  slug         text unique not null,
  title        text not null,
  body_html    text not null default '',
  -- Dónde aparece el enlace a esta página:
  show_header  boolean not null default false,   -- menú principal (nav)
  show_footer  boolean not null default false,   -- fila de enlaces del footer
  show_legal   boolean not null default false,   -- bloque legal del footer
  position     int not null default 0,            -- orden dentro de su menú
  published    boolean not null default true,     -- borrador vs público
  author_id    uuid null references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.pages is
  'Páginas estáticas del CMS (legales, estatutos, etc.), gestionadas desde /admin/paginas. body_html = HTML del editor WYSIWYG. Aparecen en header/footer/legal según flags. Público lee las publicadas; solo editores escriben.';

create index pages_menus_idx on public.pages (published, position)
  where published;

create trigger pages_set_updated_at
  before update on public.pages
  for each row execute function public.set_updated_at();

-- ============================================================================
-- RLS: público lee SOLO las publicadas; editores leen todo y escriben.
-- ============================================================================
alter table public.pages enable row level security;

create policy pages_select_public
  on public.pages for select
  using (published = true or public.is_editor());

create policy pages_write_editor
  on public.pages for all
  to authenticated
  using (public.is_editor())
  with check (public.is_editor());

commit;
