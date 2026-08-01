-- 0036_publicar_no_es_corregir.sql
-- Corrección de 0035, encontrada al verificar la ola T contra dev.
--
-- Síntoma: publicar un movimiento (published false→true) le ponía `edited_at`,
-- y como la vista pública expone esa columna, /cuentas mostraba la etiqueta
-- "corregido" en TODA línea publicada. O sea: en todas, porque publicar es el
-- paso normal para que algo aparezca ahí.
--
-- Eso vacía de significado la marca justo en la página donde más importa: si
-- todo aparece corregido, el ciudadano no puede distinguir lo que de verdad se
-- tocó. Peor que no tener marca.
--
-- Distinción que faltaba:
--   · Publicar/despublicar  → se AUDITA (queda en audit_log) pero NO marca la
--     fila como corregida: no se ha alterado ningún dato del apunte.
--   · Cambiar fecha, concepto, importe, signo, categoría o contraparte → SÍ
--     marca `edited_at`: ahí sí ha cambiado lo que el ciudadano lee.

begin;

create or replace function public.finance_movements_audit()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cambios    jsonb := '{}'::jsonb;
  corregido  boolean := false;
begin
  if new.dated is distinct from old.dated then
    cambios := cambios || jsonb_build_object('dated', jsonb_build_array(old.dated, new.dated));
    corregido := true;
  end if;
  if new.description is distinct from old.description then
    cambios := cambios || jsonb_build_object('description', jsonb_build_array(old.description, new.description));
    corregido := true;
  end if;
  if new.amount_cents is distinct from old.amount_cents then
    cambios := cambios || jsonb_build_object('amount_cents', jsonb_build_array(old.amount_cents, new.amount_cents));
    corregido := true;
  end if;
  if new.direction is distinct from old.direction then
    cambios := cambios || jsonb_build_object('direction', jsonb_build_array(old.direction, new.direction));
    corregido := true;
  end if;
  if new.category is distinct from old.category then
    cambios := cambios || jsonb_build_object('category', jsonb_build_array(old.category, new.category));
    corregido := true;
  end if;
  -- De la contraparte se registra QUE cambió, nunca el valor: si se anonimiza
  -- por una petición RGPD, volcar el nombre viejo en audit_log dejaría el dato
  -- personal justo donde se quería quitar.
  if new.counterparty_name is distinct from old.counterparty_name then
    cambios := cambios || jsonb_build_object('counterparty_name', 'modificado');
    corregido := true;
  end if;
  if new.counterparty_ref is distinct from old.counterparty_ref then
    cambios := cambios || jsonb_build_object('counterparty_ref', 'modificado');
    corregido := true;
  end if;

  -- Publicar/retirar se audita, pero NO es una corrección del apunte.
  if new.published is distinct from old.published then
    cambios := cambios || jsonb_build_object('published', jsonb_build_array(old.published, new.published));
  end if;

  if cambios = '{}'::jsonb then
    return new;
  end if;

  if corregido then
    new.edited_at := now();
    new.edited_by := auth.uid();
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, meta)
  values (
    auth.uid(),
    case when corregido then 'finance_movement_edit' else 'finance_movement_publish' end,
    'finance_movements',
    new.id,
    cambios
  );

  return new;
end;
$$;

comment on function public.finance_movements_audit() is
  '0036: audita toda escritura sobre un movimiento. Solo marca edited_at (la etiqueta "corregido" de /cuentas) cuando cambia un dato del apunte; publicar o retirar se registra pero no cuenta como corrección.';

-- Limpia las marcas que puso 0035 a filas que solo se publicaron: si nunca se
-- editó su contenido, no hay ninguna corrección que anunciar. Se conserva la
-- marca de aquellas cuya edición sí quedó registrada en audit_log.
update public.finance_movements m
   set edited_at = null, edited_by = null
 where m.edited_at is not null
   and not exists (
     select 1 from public.audit_log a
      where a.entity = 'finance_movements'
        and a.entity_id = m.id
        and a.action = 'finance_movement_edit'
   );

commit;
