-- 0062 · Nombres legibles para las categorías del tablero.
--
-- La 0032 las sembró con el slug del departamento ('autonomos', 'gasto-publico'…),
-- y esos nombres se ven tal cual en /programa, en el tablero y en el admin: sin
-- tildes ni mayúsculas. Se renombran por nombre antiguo, así que es idempotente
-- y vale igual en dev que en producción (los ids son distintos en cada una).
-- Si alguien ya las renombró a mano desde /admin/participacion/categorias, no se toca.

update public.proposal_categories set nombre = 'Autónomos/as'  where nombre = 'autonomos';
update public.proposal_categories set nombre = 'Agricultura'   where nombre = 'agricultura';
update public.proposal_categories set nombre = 'Industria'     where nombre = 'industria';
update public.proposal_categories set nombre = 'Igualdad'      where nombre = 'igualdad';
update public.proposal_categories set nombre = 'Economía'      where nombre = 'economia';
update public.proposal_categories set nombre = 'Educación'     where nombre = 'educacion';
update public.proposal_categories set nombre = 'Gasto público' where nombre = 'gasto-publico';
update public.proposal_categories set nombre = 'Vivienda'      where nombre = 'vivienda';
update public.proposal_categories set nombre = 'Justicia'      where nombre = 'justicia';
update public.proposal_categories set nombre = 'Sanidad'       where nombre = 'sanidad';
update public.proposal_categories set nombre = 'Transportes'   where nombre = 'transportes';
