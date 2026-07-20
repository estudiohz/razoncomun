'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/guard';
import { registrarAuditoria } from '@/lib/admin/audit';

/**
 * Manifiesto (D-013, decisión de Sergio, opción b): número VARIABLE de
 * puntos, editables desde este panel como si fueran noticias — SIN núcleo
 * inmutable y SIN número fijo de 30. `manifesto_points.is_core` sigue
 * existiendo en el esquema (no se toca, es propiedad de rc-02) pero ya NO
 * bloquea la edición: se muestra solo como etiqueta informativa heredada.
 *
 * Lo que SÍ es innegociable: cada cambio queda versionado en
 * `manifesto_point_versions` (tabla que rc-02 ya creó) con historial
 * PÚBLICO — sin eso se cae el relato de que el programa lo cambian los
 * afiliados. El snapshot de la versión ANTERIOR lo hace un trigger de BD
 * (0004_manifesto.sql, `manifesto_points_snapshot_trg`) automáticamente en
 * cada UPDATE que toque title/body; aquí solo nos aseguramos de incrementar
 * `version` explícitamente (el trigger no lo hace por nosotros).
 *
 * No hay estado draft/published en el esquema: cada guardado publica de
 * inmediato. "Publicación → re-indexado del cerebro" (rc-08) no tiene cola
 * ni webhook en la infraestructura actual (el job de ingesta es un
 * contenedor "restart: no" que se relanza a mano en Dokploy, ver
 * lib/brain/ingest/docker-compose.brain-ingest.yml) — así que dejamos
 * constancia explícita en audit_log y en la UI para que quien publique sepa
 * que debe relanzar el job.
 */

/** `manifesto_points.id` es `int` (no serial): siguiente id = max(id)+1. */
async function siguienteId(supabase: Awaited<ReturnType<typeof requireAdmin>>['supabase']) {
  const { data } = await supabase
    .from('manifesto_points')
    .select('id')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.id ?? 0) + 1;
}

export async function crearPunto(formData: FormData) {
  const title = String(formData.get('title') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  const { user, supabase } = await requireAdmin('/admin/manifiesto');

  if (!title || !body) throw new Error('Título y contenido son obligatorios.');

  const nuevoId = await siguienteId(supabase);
  const { error } = await supabase
    .from('manifesto_points')
    .insert({ id: nuevoId, title, body, is_core: false, version: 1 });
  if (error) throw new Error(`No se pudo crear el punto: ${error.message}`);

  await registrarAuditoria(supabase, {
    actorId: user.id,
    action: 'manifesto_point_created',
    entity: 'manifesto_points',
    // entity_id es uuid en audit_log; el id de manifesto_points es int -> va en meta (mismo
    // patrón documentado por rc-08 en lib/brain/ingest/src/connectors/manifesto.mjs).
    entityId: null,
    meta: { point_id: nuevoId, title },
  });

  revalidatePath('/admin/manifiesto');
  revalidatePath('/manifiesto');
}

export async function actualizarPunto(formData: FormData) {
  const id = Number(formData.get('id'));
  const title = String(formData.get('title') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  const { user, supabase } = await requireAdmin('/admin/manifiesto');

  if (!Number.isFinite(id)) throw new Error('Punto inválido.');
  if (!title || !body) throw new Error('Título y contenido son obligatorios.');

  const { data: actual, error: actualError } = await supabase
    .from('manifesto_points')
    .select('version, title, body')
    .eq('id', id)
    .single();
  if (actualError || !actual) throw new Error('Punto no encontrado.');

  if (actual.title === title && actual.body === body) {
    throw new Error('No hay cambios que guardar.');
  }

  const { error } = await supabase
    .from('manifesto_points')
    .update({ title, body, version: actual.version + 1 })
    .eq('id', id);
  if (error) throw new Error(`No se pudo guardar el punto: ${error.message}`);

  await registrarAuditoria(supabase, {
    actorId: user.id,
    action: 'manifesto_point_published',
    entity: 'manifesto_points',
    entityId: null,
    meta: {
      point_id: id,
      version: actual.version + 1,
      title,
      reindex_pendiente: 'rc-08: relanzar job de ingesta en Dokploy (brain-ingest)',
    },
  });

  revalidatePath('/admin/manifiesto');
  revalidatePath(`/admin/manifiesto/${id}`);
  revalidatePath('/manifiesto');
}
