-- 0048_reservar_numeros_afiliado_ilustres.sql
-- Reserva el bloque de números de afiliado 1-100 (decisión de Pablo,
-- trasladada por Sergio el 25/08/2026): marketing quiere dejarlos libres
-- para personajes ilustres, así que la numeración pública/real de altas
-- empieza en 101.
--
-- No es el "hueco accidental" que 0037/0038 querían evitar (número que
-- desaparece del libro y podría reutilizarse sin más contexto): es un
-- bloque reservado a propósito y documentado aquí, en el propio libro de
-- afiliados. `asignar_numero_afiliado()` (0038) sigue intacta: solo se
-- adelanta el contador `settings.last_member_number` para que el próximo
-- correlativo sea 101, no se toca nada de lo ya asignado.
--
-- greatest(...) hace la migración idempotente y respeta el invariante de
-- 0038 (el contador solo crece): si ya hay afiliados numerados por encima
-- de 100 al ejecutarla, no los pisa ni retrocede el contador.

begin;

update public.settings
   set value = to_jsonb(greatest((value)::int, 100)),
       updated_at = now()
 where key = 'last_member_number';

comment on table public.settings is
  'Ajustes globales editables desde el panel. Incluye `last_member_number` (0038, 0048): último número de afiliado emitido; el 1-100 queda reservado (personajes ilustres, marketing) así que arranca en 100 y el próximo correlativo es 101.';

commit;
