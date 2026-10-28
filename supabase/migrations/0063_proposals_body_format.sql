-- 0063 · proposals.body_format dejó de mentir.
--
-- La columna nació en la 0049 con el valor por defecto 'markdown', pero el cuerpo
-- de las propuestas siempre se guardó como HTML (textoPlanoAHtml al crear, el
-- editor visual al editar). Las filas que empiezan por una etiqueta HTML se
-- marcan como 'html'. Idempotente.

update public.proposals
   set body_format = 'html'
 where body_format = 'markdown'
   and left(btrim(body), 1) = '<';
