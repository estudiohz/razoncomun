-- 0080 · Auditoría — foto de cabecera y fotograma del reel del caso.
--
-- La ficha pública del caso usa la misma plantilla que una noticia (cabecera
-- con imagen 21:9 + sidebar). La imagen vive en el bucket público `articulos`
-- (carpeta `auditorias/`) y aquí solo se guarda su URL. Es decorativa: no
-- forma parte de los hechos, así que se puede cambiar con el caso publicado
-- sin abrir versión nueva. `reel_frame` es el fotograma del reel de origen
-- que encabeza el sidebar de la ficha (se sube a mano: el vídeo solo está en
-- el bucket privado de copias).

begin;

alter table public.watchdog_alerts
  add column if not exists cover_image text,
  add column if not exists reel_frame  text;

commit;
