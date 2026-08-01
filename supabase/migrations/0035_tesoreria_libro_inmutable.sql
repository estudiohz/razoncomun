-- 0035_tesoreria_libro_inmutable.sql
-- Ola T0 de Tesorería. Convierte finance_movements en un libro contable
-- solo-añadir, auditable y a prueba de reimportaciones.
--
-- Tres problemas que resuelve, todos en BD y no en la app (si la regla vive
-- solo en la interfaz, no es una regla: es una sugerencia):
--
--  1. REIMPORTAR DUPLICA. Los extractos del banco se descargan con rangos
--     solapados. Sin clave natural, importar julio dos veces duplica los
--     ingresos y la web de transparencia miente. Se añade `dedupe_key`
--     calculada por la propia BD + índice único: reimportar es inofensivo.
--
--  2. "NUNCA SE ELIMINA" (regla de Sergio: somos transparentes). Hasta ahora
--     eso dependía de que la UI no pintara un botón de borrar; la policy de
--     DELETE existía. Se elimina la policy: ni tesorería ni un admin pueden
--     borrar un movimiento por PostgREST, ni con curl.
--
--  3. EDITAR PUEDE OCULTAR TANTO COMO BORRAR. Editar es legítimo y a veces
--     obligatorio (anonimizar el nombre de un donante, RGPD Art. 17 — el
--     movimiento no se borra, el dato personal sí se puede tachar). Pero una
--     edición silenciosa vacía de contenido la promesa de transparencia. Un
--     trigger deja TODA edición en `audit_log` con el antes y el después, y
--     marca la fila como editada; la marca es visible en la web pública.

begin;

-- ============================================================================
-- 1. Deduplicación de importaciones
-- ============================================================================
-- Clave natural del movimiento tal y como lo da el banco. `description` se
-- normaliza (minúsculas y espacios colapsados) porque algunos bancos cambian
-- el espaciado entre descargas del mismo apunte.

-- No se puede usar una columna GENERATED: `date::text` (y `to_char`) dependen
-- de DateStyle, así que Postgres las considera STABLE y no IMMUTABLE, y rechaza
-- la expresión generada (42P17). Se calcula en un trigger, que sí admite
-- funciones stable y además deja normalizar la descripción con comodidad.

alter table public.finance_movements
  add column dedupe_key text;

comment on column public.finance_movements.dedupe_key is
  '0035: huella del apunte tal cual lo da el banco (origen+fecha+importe+signo+descripción normalizada). Índice único: reimportar un extracto solapado no duplica. La rellena finance_movements_dedupe(); no escribirla desde la app.';

create or replace function public.finance_movements_dedupe()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.dedupe_key := md5(
    coalesce(new.source, '') || '|' ||
    to_char(new.dated, 'YYYY-MM-DD') || '|' ||
    new.amount_cents::text || '|' ||
    new.direction || '|' ||
    lower(regexp_replace(coalesce(new.description, ''), '\s+', ' ', 'g'))
  );
  return new;
end;
$$;

create trigger finance_movements_dedupe_trg
  before insert or update of source, dated, amount_cents, direction, description
  on public.finance_movements
  for each row execute function public.finance_movements_dedupe();

-- Rellena las filas que ya existieran antes de esta migración.
update public.finance_movements set dedupe_key = md5(
  coalesce(source, '') || '|' || to_char(dated, 'YYYY-MM-DD') || '|' ||
  amount_cents::text || '|' || direction || '|' ||
  lower(regexp_replace(coalesce(description, ''), '\s+', ' ', 'g'))
) where dedupe_key is null;

create unique index finance_movements_dedupe_key_idx
  on public.finance_movements (dedupe_key);

-- ============================================================================
-- 2. El libro no se borra
-- ============================================================================

drop policy if exists finance_movements_delete_treasury on public.finance_movements;

comment on table public.finance_movements is
  'Libro de movimientos (importado del banco o manual). SOLO-AÑADIR: no existe policy de DELETE a propósito (0035) — un movimiento nunca se borra, se corrige y queda la traza. RAW con contraparte: solo admin/tesorería. Proyección pública: finance_movements_public.';

-- ============================================================================
-- 3. Traza de ediciones
-- ============================================================================

alter table public.finance_movements
  add column edited_at  timestamptz,
  add column edited_by  uuid references public.profiles(id);

comment on column public.finance_movements.edited_at is
  '0035: fecha de la última corrección. Se expone en la vista pública: si una línea se tocó, el ciudadano lo ve.';

create or replace function public.finance_movements_audit()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cambios jsonb := '{}'::jsonb;
begin
  -- Solo se registran los campos con significado contable o de privacidad.
  if new.dated is distinct from old.dated then
    cambios := cambios || jsonb_build_object('dated', jsonb_build_array(old.dated, new.dated));
  end if;
  if new.description is distinct from old.description then
    cambios := cambios || jsonb_build_object('description', jsonb_build_array(old.description, new.description));
  end if;
  if new.amount_cents is distinct from old.amount_cents then
    cambios := cambios || jsonb_build_object('amount_cents', jsonb_build_array(old.amount_cents, new.amount_cents));
  end if;
  if new.direction is distinct from old.direction then
    cambios := cambios || jsonb_build_object('direction', jsonb_build_array(old.direction, new.direction));
  end if;
  if new.category is distinct from old.category then
    cambios := cambios || jsonb_build_object('category', jsonb_build_array(old.category, new.category));
  end if;
  if new.published is distinct from old.published then
    cambios := cambios || jsonb_build_object('published', jsonb_build_array(old.published, new.published));
  end if;
  -- De la contraparte se registra QUE cambió, nunca el valor: si se anonimiza
  -- por una petición RGPD, volcar el nombre viejo en audit_log dejaría el dato
  -- personal justo donde se quería quitar.
  if new.counterparty_name is distinct from old.counterparty_name then
    cambios := cambios || jsonb_build_object('counterparty_name', 'modificado');
  end if;
  if new.counterparty_ref is distinct from old.counterparty_ref then
    cambios := cambios || jsonb_build_object('counterparty_ref', 'modificado');
  end if;

  if cambios = '{}'::jsonb then
    return new;
  end if;

  new.edited_at := now();
  new.edited_by := auth.uid();

  insert into public.audit_log (actor_id, action, entity, entity_id, meta)
  values (auth.uid(), 'finance_movement_edit', 'finance_movements', new.id, cambios);

  return new;
end;
$$;

comment on function public.finance_movements_audit() is
  '0035: toda corrección de un movimiento queda en audit_log con antes/después. De la contraparte solo se registra que cambió, nunca el valor (anonimizar no puede dejar el dato personal en el log).';

create trigger finance_movements_audit_trg
  before update on public.finance_movements
  for each row execute function public.finance_movements_audit();

-- ============================================================================
-- 4. La vista pública enseña la marca de edición
-- ============================================================================
-- Sigue SIN contraparte y solo con published=true. Se añade edited_at para que
-- la transparencia incluya "esta línea se corrigió", no solo el importe.

drop view if exists public.finance_movements_public;

create view public.finance_movements_public
  with (security_barrier = true) as
  select
    id,
    dated,
    description,
    amount_cents,
    direction,
    currency,
    category,
    edited_at
  from public.finance_movements
  where published;

comment on view public.finance_movements_public is
  '0035: proyección pública del libro. Sin counterparty_name/ref (datos personales) y solo filas aprobadas. edited_at permite marcar en /cuentas las líneas corregidas.';

grant select on public.finance_movements_public to anon, authenticated;

commit;
