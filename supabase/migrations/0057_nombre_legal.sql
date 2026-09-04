-- 0057_nombre_legal.sql
--
-- Nombre y apellidos del socio, separado del nombre visible.
--
-- SÍNTOMA (Sergio, 04/09/2026): se descargó su carnet recién emitido y ponía
-- solo "Sergio". El carnet leía `display_name`, que es el nombre que cada cual
-- elige para la web y puede ser un apodo o, como aquí, solo el nombre de pila.
--
-- Lo mismo afectaba —peor— al CERTIFICADO FISCAL: también salía de
-- `display_name`, así que un certificado para presentar en la declaración
-- podía ir sin apellidos. Un documento así no le sirve a nadie.
--
-- POR QUÉ UNA COLUMNA NUEVA Y NO REUTILIZAR `display_name`
--   Son dos cosas distintas y conviene que sigan siéndolo. `display_name` es
--   cómo te llamas en la web (comentarios, propuestas) y lo eliges tú.
--   `legal_name` es cómo te llamas en el DNI, y es lo que tiene que aparecer
--   en un carnet que acredita la condición de socio y en un papel que va a
--   Hacienda. Pisar el primero con el segundo cambiaría en silencio cómo
--   aparece alguien publicado en toda la web.
--
--   Se recoge en el ALTA, no en el registro: es el mismo dato que el mandato
--   SEPA necesita como titular de la cuenta, así que ya se estaba pidiendo —
--   solo que se le mandaba a Stripe y no se guardaba.

begin;

alter table public.profiles
  add column if not exists legal_name text;

comment on column public.profiles.legal_name is
  '0057: nombre y apellidos reales, los del carnet y el certificado fiscal. Distinto de `display_name`, que es el nombre visible en la web y puede ser un apodo. Se recoge en el alta de socio (titular del mandato/método de pago). Null en quien nunca ha sido socio.';

commit;
