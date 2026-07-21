-- 0031_simulador_fuente_url.sql
-- Sergio: "en el backend vas a dividir el input field de fuente en 2. El
-- actual + URL de la fuente" — el campo de texto libre "fuente" (que hasta
-- ahora mezclaba descripción y, a veces, un enlace pegado a mano dentro del
-- mismo texto) se separa en descripción + URL propia, para poder enlazar la
-- fuente oficial (BOE/PGE/INE/AEAT...) de forma clicable en el panel público
-- sin depender de que el texto libre contuviera un enlace bien formado.
--
-- Solo se AÑADE una columna nullable en cada tabla que ya tenía "fuente" en
-- texto libre — el texto existente NO se toca ni se intenta parsear para
-- extraer una URL (evita adivinar mal); el equipo rellena la URL a mano
-- desde el admin de aquí en adelante, igual que ha rellenado cada fuente
-- hasta ahora (D-S1: los datos son de autoría humana).

begin;

alter table public.sim_partidas
  add column if not exists fuente_actual_url text null;

comment on column public.sim_partidas.fuente_actual_url is
  'URL de la fuente oficial (BOE/PGE/IGAE...) que respalda fuente_actual. Opcional; se muestra como enlace en /pais cuando está presente.';

alter table public.sim_parametros
  add column if not exists fuente_actual_url text null;

comment on column public.sim_parametros.fuente_actual_url is
  'URL de la fuente oficial que respalda fuente_actual. Opcional; se muestra como enlace en /pais cuando está presente.';

alter table public.sim_demografia
  add column if not exists fuente_url text null;

comment on column public.sim_demografia.fuente_url is
  'URL de la fuente oficial (INE/EPA/SEPE...) que respalda fuente. Opcional; se muestra como enlace en /pais cuando está presente.';

commit;
