-- 0052_shop_product_content.sql
-- Ficha editable de cada producto de la tienda (docs/tecnico/tienda-printful.md).
--
-- POR QUÉ EXISTE: Printful es la fuente del catálogo (D-T1) pero NO trae
-- descripción, ni guía de tallas, ni plazo de entrega, ni fotos de uso. La
-- ficha se quedaba en nombre + precio, que es justo lo que no vende. Esto es
-- lo único de la tienda que se escribe a mano, y va aquí para que lo edite
-- cualquiera del equipo desde /admin/tienda sin tocar código.
--
-- NO es una réplica del catálogo: no hay nombre, ni precio, ni stock, ni
-- imágenes de producto. Si Printful y esta tabla discrepasen en algo de eso,
-- manda Printful; aquí solo vive el texto que Printful no sabe.
--
-- La clave primaria es el id del SYNC PRODUCT de Printful (el de la URL
-- /tienda/{id}), no un uuid: así la fila se localiza sin tabla de traducción
-- y borrar el producto en Printful deja una fila huérfana inofensiva que
-- nunca se lee. Es un `bigint` porque los ids de Printful ya rondan los
-- 460.000.000 y siguen creciendo.

begin;

create table public.shop_product_content (
  printful_product_id bigint primary key,
  -- HTML del editor visual. Se sanea AL RENDERIZAR (lib/blog/html.ts), nunca
  -- se confía en lo que haya aquí: ver la cabecera de ese fichero.
  description_html    text not null default '',
  -- Guía de tallas: solo tiene sentido en ropa, por eso es opcional y se
  -- pinta plegada. Vacío = no se enseña nada.
  size_guide_html     text not null default '',
  -- Plazo de entrega en texto libre ("3-6 días laborables"): es un dato
  -- comercial que cambia por temporada, no un número que podamos calcular.
  delivery_note       text not null default '',
  -- Fotos de uso (URLs), que se añaden a los mockups de Printful en la
  -- galería. Array y no tabla aparte: son unas pocas y el orden importa.
  extra_images        text[] not null default '{}',
  updated_by          uuid null references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.shop_product_content is
  'Texto y fotos de la ficha de cada producto de la tienda. Printful no los trae. La PK es el id del sync product de Printful.';
comment on column public.shop_product_content.extra_images is
  'Fotos de uso subidas por el equipo; se muestran en la galería DESPUÉS de los mockups de Printful.';

create trigger shop_product_content_set_updated_at
  before update on public.shop_product_content
  for each row execute function public.set_updated_at();

-- ============================================================================
-- RLS: la ficha es contenido público de una página pública; escribe el equipo.
-- ============================================================================
alter table public.shop_product_content enable row level security;

-- Lectura abierta: no hay estado "borrador" porque una ficha sin texto
-- simplemente no pinta nada. Un campo `published` aquí sería una palanca que
-- nadie usaría y una forma más de que un producto salga sin descripción.
create policy shop_product_content_select_public
  on public.shop_product_content for select
  using (true);

create policy shop_product_content_write_editor
  on public.shop_product_content for all
  to authenticated
  using (public.is_editor())
  with check (public.is_editor());

commit;
