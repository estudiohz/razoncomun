-- 0010_blog.sql
-- Blog y observatorio (contenido público, SEO): categories, articles.

begin;

create table public.categories (
  id     serial primary key,
  slug   text unique not null,
  name   text not null,
  color  text not null
);

create table public.articles (
  id            uuid primary key default extensions.gen_random_uuid(),
  slug          text unique not null,          -- URL SEO: /blog/{slug}
  title         text not null,
  excerpt       text,
  body          text not null,                 -- markdown/HTML
  category_id   int references public.categories(id),
  cover_image   text,
  author_id     uuid references public.profiles(id),
  source_type   text not null check (source_type in ('editorial', 'observatorio')),
  source_urls   text[] not null default '{}',   -- fuentes citadas (obligatorio)
  status        text not null default 'draft' check (status in ('draft', 'published')),
  published_at  timestamptz null,
  seo_title     text,
  seo_desc      text,
  created_at    timestamptz not null default now()
);

create index articles_category_idx on public.articles(category_id);
create index articles_status_idx on public.articles(status);
create index articles_published_at_idx on public.articles(published_at desc) where status = 'published';

alter table public.categories enable row level security;
alter table public.articles enable row level security;

-- categories: catálogo público, escritura editor/admin.
create policy categories_select_public
  on public.categories for select
  to anon, authenticated
  using (true);

create policy categories_write_editor
  on public.categories for all
  to authenticated
  using (public.is_editor())
  with check (public.is_editor());

-- articles: público solo ve status='published'; editor/admin ve y gestiona todo (incl. drafts).
create policy articles_select_published_or_team
  on public.articles for select
  to anon, authenticated
  using (status = 'published' or public.is_editor());

create policy articles_write_editor
  on public.articles for all
  to authenticated
  using (public.is_editor())
  with check (public.is_editor());

commit;
