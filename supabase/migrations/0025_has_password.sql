-- 0025_has_password.sql
-- has_password(): señal fiable de "¿el usuario actual tiene contraseña puesta en GoTrue?".
--
-- Contexto: la auth soporta contraseña + enlace mágico (passwordless). Un usuario que entra
-- solo por enlace mágico puede no fijar contraseña nunca. Se necesita este signal para que
-- /perfil (a) deje fijar una contraseña y (b) muestre un aviso mientras no exista, y Supabase
-- no expone auth.users.encrypted_password al cliente por ninguna vía de PostgREST.
--
-- Por qué SECURITY DEFINER: auth.users pertenece al esquema de GoTrue; anon/authenticated no
-- tienen (ni deben tener) privilegios de lectura sobre él. La función corre con los privilegios
-- de su owner (postgres, igual que el resto de funciones helper de este esquema — ver
-- is_active_member_since() y compañía en 0003_identity.sql) para poder leer encrypted_password,
-- pero NUNCA lo expone fuera de la función: el resultado es un booleano derivado, no el hash.
--
-- Por qué NO acepta un parámetro user_id (a propósito, no es un olvido): si aceptara uno,
-- cualquier usuario autenticado podría preguntar por la contraseña de OTRO, es decir,
-- enumerar qué cuentas son "solo magic link" — información útil para dirigir un intento de
-- account-takeover (esas cuentas no tienen contraseña que forzar, pero sí un enlace mágico que
-- interceptar/phishear). La función se ata SIEMPRE a auth.uid(): no hay forma de preguntar por
-- otro usuario, ni siquiera para un admin.
--
-- Sin sesión (auth.uid() IS NULL): debe devolver false, NUNCA null. Un valor null rompería
-- cualquier chequeo del tipo `if (!hasPassword)` en el cliente si null y false no se tratan
-- exactamente igual en esa capa; el coalesce(...) final lo garantiza sin ambigüedad.
--
-- set search_path = public, auth: incluye auth para que la función pueda resolver el esquema
-- de GoTrue. auth.users se referencia además SIEMPRE cualificado ("auth.users", no "users") como
-- cinturón y tirantes: aunque alguien lograra colar un objeto llamado "users" antes en el
-- search_path, la referencia cualificada no se vería afectada (mismo principio de search_path
-- fijo que ya usa todo helper SECURITY DEFINER de 0003_identity.sql, aplicado aquí también al
-- esquema auth porque es la primera función de este proyecto que necesita leer auth.users).

begin;

create or replace function public.has_password()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    (
      select u.encrypted_password is not null and u.encrypted_password <> ''
      from auth.users u
      where u.id = auth.uid()
    ),
    false
  );
$$;

comment on function public.has_password() is
  'Señal para /perfil: true si el usuario autenticado actual (auth.uid()) tiene contraseña '
  'puesta en GoTrue (auth.users.encrypted_password not null y no vacío) -- típicamente false '
  'para quien solo ha entrado por enlace mágico. SECURITY DEFINER porque anon/authenticated no '
  'tienen acceso de lectura a auth.users; la función solo devuelve un booleano derivado, nunca '
  'el hash. Sin parámetro user_id A PROPÓSITO: siempre pregunta por auth.uid(), nunca por otro '
  'usuario -- evita que una cuenta autenticada enumere qué otras cuentas son "solo magic link". '
  'Con auth.uid() NULL (sin sesión) devuelve false, no null, para que el aviso de "falta '
  'contraseña" en el cliente no dependa de cómo esa capa trate un null.';

-- Privilegios: mismo patrón que 0016_ai_provider_credentials.sql -- un "revoke ... from public"
-- NO basta en este proyecto, porque "alter default privileges ... grant all on functions to
-- anon, authenticated, service_role" concede EXECUTE a esos roles de forma directa al crear la
-- función, no vía PUBLIC (verificado en vivo en dev-api.razoncomun.com para ese caso). Hay que
-- revocar explícitamente de cada rol y conceder solo donde corresponde.
--
-- anon queda FUERA a propósito: sin sesión no hay auth.uid() que consultar (la función ya
-- devuelve false en ese caso, pero además no tiene sentido exponer la llamada a quien no está
-- logueado -- el aviso de "falta contraseña" solo aplica ya autenticado).
revoke all on function public.has_password() from public, anon, authenticated;
grant execute on function public.has_password() to authenticated;

commit;
