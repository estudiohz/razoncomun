-- 0053_payment_provider_credentials.sql
-- Credenciales de las pasarelas de pago y métodos activos, gestionados desde
-- /admin/tienda/pagos en vez de por variables de entorno de Dokploy.
--
-- POR QUÉ: hasta ahora la clave de Stripe vive en el env de `rc-webapp`.
-- Cambiarla exige entrar en Dokploy y redesplegar, y solo puede hacerlo quien
-- tenga acceso al panel del servidor. Sergio quiere pegarla desde el admin.
-- Lo que NO se hace es inventar un "conectar con un botón de login": eso
-- (Stripe Connect, PayPal Partner Referrals) existe para plataformas que dan
-- de alta cuentas de TERCEROS. Con una sola cuenta propia, la conexión es por
-- credencial, y un botón de login sería un formulario disfrazado.
--
-- Se calca el modelo de amenaza y el diseño de 0016_ai_provider_credentials:
--   1. El secreto se cifra con pgcrypto; la CLAVE MAESTRA nunca se guarda en
--      la base -- llega como parámetro desde el entorno de la app
--      (PAYMENT_CREDENTIALS_MASTER_KEY). Un dump robado sin ella es inútil.
--   2. Solo `service_role`: RLS activada SIN policies + REVOKE explícito a
--      anon/authenticated (no fiarse solo de RLS para algo que mueve dinero).
--   3. La UI nunca ve el secreto: se guarda aparte `key_suffix` (4 últimos
--      caracteres en claro) para identificar la clave sin descifrar nada.
--   4. En Stripe, `mode` (test/live) NO se elige en un desplegable: se DERIVA
--      del prefijo de la propia clave. Una etiqueta que puede contradecir a la
--      clave es peor que no tener etiqueta, y aquí la diferencia entre las dos
--      es cobrar dinero de verdad o no cobrarlo.

begin;

-- ============================================================================
-- CREDENCIALES
-- ============================================================================

create table public.payment_provider_credentials (
  id                uuid primary key default extensions.gen_random_uuid(),
  provider          text not null check (provider in ('stripe', 'paypal')),
  mode              text not null check (mode in ('test', 'live')),
  -- Stripe: sk_... · PayPal: client secret.
  secret_encrypted  bytea not null,
  -- Stripe: pk_... · PayPal: client id. NO es secreto (viaja al navegador),
  -- por eso se guarda en claro: cifrar algo público solo estorba y encima
  -- obligaría a descifrar para pintar una página.
  public_key        text not null default '',
  -- Stripe: whsec_... Opcional: el webhook se crea después de pegar la clave.
  webhook_encrypted bytea null,
  key_suffix        text not null,
  active            boolean not null default false,
  changed_by        uuid null references public.profiles(id) on delete set null,
  changed_at        timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

comment on table public.payment_provider_credentials is
  'Claves de las pasarelas de pago, cifradas con pgcrypto. La clave maestra vive SOLO en el '
  'entorno de la app (PAYMENT_CREDENTIALS_MASTER_KEY), nunca aquí. Solo service_role.';
comment on column public.payment_provider_credentials.mode is
  'test o live. En Stripe se DERIVA del prefijo de la clave, no se elige.';
comment on column public.payment_provider_credentials.public_key is
  'Clave publicable (Stripe pk_...) o client id (PayPal). Pública por definición: sin cifrar.';
comment on column public.payment_provider_credentials.key_suffix is
  'Últimos 4 caracteres del secreto, para que la UI identifique la clave sin descifrarla.';

-- Una sola credencial activa por pasarela, garantizado en el ESQUEMA y no en
-- la aplicación: dos claves activas de Stripe significarían cobrar unas veces
-- en test y otras en live sin saber cuál toca.
create unique index payment_provider_credentials_active_uidx
  on public.payment_provider_credentials (provider)
  where active;

alter table public.payment_provider_credentials enable row level security;
revoke all on public.payment_provider_credentials from anon;
revoke all on public.payment_provider_credentials from authenticated;
-- Sin policies a propósito: ni un admin autenticado lee esta tabla con su
-- sesión. Todo pasa por service_role desde el servidor.

-- ============================================================================
-- MÉTODOS DE PAGO (interruptores)
-- ============================================================================
-- Qué se le ofrece al comprador. Lista CERRADA sembrada aquí, no texto libre:
-- un método inventado en la UI se traduce en un método que la pasarela rechaza
-- en el momento de pagar, con el cliente delante.
--
-- ⚠️ Esto NO activa nada en Stripe. Cada método hay que habilitarlo también en
-- el panel de Stripe (Settings -> Payment methods). Este interruptor sirve para
-- APAGAR desde aquí algo que Stripe ya permite, no para encenderlo.

create table public.payment_methods (
  code        text primary key,
  label       text not null,
  provider    text not null check (provider in ('stripe', 'paypal')),
  enabled     boolean not null default false,
  position    integer not null default 0,
  updated_at  timestamptz not null default now()
);

comment on table public.payment_methods is
  'Métodos ofrecidos en el checkout de la tienda. Apagar aquí quita el método; encender aquí '
  'NO basta: hay que habilitarlo también en el panel de Stripe.';

create trigger payment_methods_set_updated_at
  before update on public.payment_methods
  for each row execute function public.set_updated_at();

insert into public.payment_methods (code, label, provider, enabled, position) values
  ('card',       'Tarjeta',    'stripe', true,  10),
  ('bizum',      'Bizum',      'stripe', false, 20),
  ('paypal',     'PayPal',     'stripe', false, 30),
  ('klarna',     'Klarna',     'stripe', false, 40),
  ('google_pay', 'Google Pay', 'stripe', false, 50),
  ('apple_pay',  'Apple Pay',  'stripe', false, 60)
on conflict (code) do nothing;

-- Aquí no hay secretos, solo on/off: el admin autenticado puede leer y
-- escribir con su propia sesión, sin pasar por service_role.
alter table public.payment_methods enable row level security;

create policy payment_methods_select_admin
  on public.payment_methods for select
  to authenticated
  using (public.is_admin());

create policy payment_methods_write_admin
  on public.payment_methods for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================================
-- FUNCIONES (SECURITY DEFINER, solo service_role) -- mismo patrón que 0016
-- ============================================================================

create or replace function public.payment_credentials_set(
  p_provider   text,
  p_secret     text,
  p_public_key text,
  p_webhook    text,
  p_mode       text,
  p_master_key text,
  p_changed_by uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_id uuid;
  v_mode   text;
  v_secret text := trim(p_secret);
begin
  if coalesce(auth.role(), 'service_role') <> 'service_role' then
    raise exception 'payment_provider_credentials: solo service_role puede modificar credenciales de pago';
  end if;

  if p_provider not in ('stripe', 'paypal') then
    raise exception 'pasarela no soportada: %', p_provider;
  end if;

  if v_secret is null or length(v_secret) < 12 then
    raise exception 'secreto invalido (demasiado corto o vacio)';
  end if;

  if p_master_key is null or length(p_master_key) = 0 then
    raise exception 'clave maestra requerida (nunca se guarda en BD; debe llegar del entorno de la app)';
  end if;

  if p_provider = 'stripe' then
    -- El prefijo de Stripe lo dice sin ambigüedad: se ignora lo que diga
    -- p_mode. Si la clave no tiene prefijo reconocible se rechaza, en vez de
    -- guardarla con un modo inventado.
    if v_secret like 'sk_live_%' or v_secret like 'rk_live_%' then
      v_mode := 'live';
    elsif v_secret like 'sk_test_%' or v_secret like 'rk_test_%' then
      v_mode := 'test';
    else
      raise exception 'la clave de Stripe debe empezar por sk_test_, sk_live_, rk_test_ o rk_live_';
    end if;
  else
    -- PayPal no marca el entorno en la credencial: hay que decirlo. Ante la
    -- duda, test -- nunca live por defecto.
    v_mode := case when p_mode = 'live' then 'live' else 'test' end;
  end if;

  update public.payment_provider_credentials
     set active = false
   where provider = p_provider and active;

  insert into public.payment_provider_credentials
    (provider, mode, secret_encrypted, public_key, webhook_encrypted, key_suffix, active, changed_by, changed_at)
  values (
    p_provider,
    v_mode,
    extensions.pgp_sym_encrypt(v_secret, p_master_key),
    coalesce(trim(p_public_key), ''),
    case when p_webhook is null or length(trim(p_webhook)) = 0
         then null
         else extensions.pgp_sym_encrypt(trim(p_webhook), p_master_key) end,
    right(v_secret, 4),
    true, p_changed_by, now()
  )
  returning id into v_new_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, meta)
  values (
    p_changed_by, 'payment_credentials_set', 'payment_provider_credentials', v_new_id,
    jsonb_build_object('provider', p_provider, 'mode', v_mode)
  );

  return v_new_id;
end;
$$;

comment on function public.payment_credentials_set(text, text, text, text, text, text, uuid) is
  'Guarda y activa la credencial de una pasarela, cifrando el secreto con la clave maestra '
  'recibida como parametro (nunca almacenada). En Stripe el modo test/live se deriva del '
  'prefijo de la clave y p_mode se ignora. SOLO service_role. Registra en audit_log.';

create or replace function public.payment_credentials_get_active(
  p_provider   text,
  p_master_key text
)
returns table (
  id             uuid,
  provider       text,
  mode           text,
  secret         text,
  public_key     text,
  webhook_secret text,
  key_suffix     text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), 'service_role') <> 'service_role' then
    raise exception 'payment_provider_credentials: solo service_role puede leer credenciales de pago';
  end if;

  if p_master_key is null or length(p_master_key) = 0 then
    raise exception 'clave maestra requerida';
  end if;

  return query
    select
      c.id,
      c.provider,
      c.mode,
      extensions.pgp_sym_decrypt(c.secret_encrypted, p_master_key) as secret,
      c.public_key,
      case when c.webhook_encrypted is null then null
           else extensions.pgp_sym_decrypt(c.webhook_encrypted, p_master_key) end as webhook_secret,
      c.key_suffix
    from public.payment_provider_credentials c
    where c.provider = p_provider and c.active
    limit 1;
end;
$$;

comment on function public.payment_credentials_get_active(text, text) is
  'Descifra la credencial activa de una pasarela. Reservada al momento exacto de hablar con la '
  'pasarela desde el backend: el secreto NUNCA debe salir en una respuesta a la UI. Con la clave '
  'maestra incorrecta, pgp_sym_decrypt lanza excepcion en vez de devolver basura.';

-- Ver la nota de 0016: "REVOKE ... FROM PUBLIC" no basta, porque los default
-- privileges del proyecto conceden EXECUTE a anon/authenticated de forma
-- directa al crear la funcion. Hay que revocar de cada rol explicitamente.
revoke all on function public.payment_credentials_set(text, text, text, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.payment_credentials_get_active(text, text) from public, anon, authenticated;
grant execute on function public.payment_credentials_set(text, text, text, text, text, text, uuid) to service_role;
grant execute on function public.payment_credentials_get_active(text, text) to service_role;

commit;
