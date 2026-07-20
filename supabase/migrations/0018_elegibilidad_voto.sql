-- 0018_elegibilidad_voto.sql
--
-- Ajusta la elegibilidad para voto vinculante según el modelo de participación
-- que fijó Sergio (D-017). Cambia DOS cosas respecto a 0006:
--
--   1. Antigüedad mínima: 3 meses -> 1 semana.
--   2. Verificación de identidad: se exigía SOLO en votaciones de manifiesto;
--      ahora se exige en TODO voto vinculante (también 'department').
--
-- MODELO DE PARTICIPACIÓN (D-017):
--   registrado  -> Google/Facebook/email, sin verificación. Discord, likes,
--                  sugerencias, simulador de presupuesto público. Sin efecto
--                  vinculante. Es el embudo de captación: cero fricción.
--   afiliado    -> cuota (mandato SEPA) + verificación de identidad en el mismo
--   verificado     paso. Es quien vota las decisiones oficiales del partido.
--
-- POR QUÉ 1 SEMANA BASTA AQUÍ, pese a ser un plazo corto frente al entrismo:
-- la antigüedad no trabaja sola. Para votar hay que (a) pagar cuota con mandato
-- SEPA a nombre propio, (b) superar verificación documental de identidad, y
-- (c) estar en el censo, que se congela al abrir la votación — quien se afilia
-- después no vota en ella. No se fabrican afiliados falsos en masa con eso: la
-- verificación de identidad hace el trabajo pesado, la antigüedad es una capa
-- secundaria contra la afiliación oportunista de última hora.
--
-- El riesgo residual aceptado es la entrada coordinada de personas REALES que
-- pagan y se verifican — difícil de distinguir de una campaña de captación
-- legítima, y por tanto no es un problema que deba resolver el esquema.
--
-- Cambio del orquestador sobre la zona de rc-02-datos (dueño del esquema):
-- ajuste de parámetros de una función existente, sin tocar tablas ni políticas.

begin;

create or replace function public.ballot_eligible(p_user uuid, p_vote_id uuid, p_weight smallint)
returns boolean
language sql stable security definer set search_path = public as $$
  select case
    -- Consultivo: cualquier usuario registrado. No decide nada, solo informa.
    when p_weight = 0 then true
    -- Vinculante: afiliado activo con >= 1 semana Y verificado, en cualquier
    -- ámbito. La comprobación de ventana temporal y censo la hacen las
    -- políticas de `ballots` definidas en 0006, que no se tocan aquí.
    when p_weight = 1 then (
      public.is_active_member_since(p_user, interval '1 week')
      and public.is_verified(p_user)
    )
    else false
  end;
$$;

comment on function public.ballot_eligible(uuid, uuid, smallint) is
  'Elegibilidad de voto (D-017): consultivo abierto a registrados; vinculante '
  'exige afiliado activo con antigüedad >= 1 semana Y identidad verificada, en '
  'todos los ámbitos. Sustituye la regla de 0006 (3 meses, y verificación solo '
  'en manifiesto).';

commit;
