-- 0059_nombre_y_apellidos.sql
--
-- Parte `legal_name` (0057) en `first_name` y `last_name`.
--
-- POR QUÉ, y no es solo preferencia de formulario (Sergio, 04/09/2026):
--
--   1. **El Modelo 182 de la AEAT pide "apellidos y nombre" EN ESE ORDEN.**
--      De un campo libre no se puede sacar: no hay regla que acierte con
--      "María del Carmen García López" —¿dónde acaba el nombre?— ni con un
--      apellido compuesto tipo "De la Fuente". Guardándolos separados, el
--      fichero fiscal se construye sin adivinar nada.
--   2. En España el formulario natural son dos campos, y pedir "nombre y
--      apellidos" en uno solo invita a que la gente escriba cualquier cosa.
--
-- MIGRACIÓN DE LO YA ESCRITO: se parte por el primer espacio, que es una
-- aproximación y no una regla — es exactamente el problema que esta migración
-- viene a evitar. Se asume porque en dev hay UNA fila con dato y su titular
-- puede corregirla en su perfil en diez segundos. Si algún día se aplica esto
-- con volumen real, hay que revisar el reparto a mano, no confiar en el split.

begin;

alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name  text;

comment on column public.profiles.first_name is
  '0059: nombre de pila. Junto con `last_name` forma el nombre del carnet y del certificado fiscal. Separados porque el Modelo 182 exige "apellidos y nombre" en ese orden y de un campo único no se puede derivar.';
comment on column public.profiles.last_name is
  '0059: apellidos. Ver `first_name`.';

-- Reparto aproximado de lo que hubiera en `legal_name`.
update public.profiles
   set first_name = split_part(btrim(legal_name), ' ', 1),
       last_name  = nullif(btrim(substr(btrim(legal_name), strpos(btrim(legal_name), ' ') + 1)), '')
 where legal_name is not null
   and btrim(legal_name) <> ''
   and first_name is null;

alter table public.profiles drop column if exists legal_name;

commit;
