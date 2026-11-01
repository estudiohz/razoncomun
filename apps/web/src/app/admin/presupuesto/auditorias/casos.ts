'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAuditor } from '@/lib/admin/guard';
import { registrarAuditoria } from '@/lib/admin/audit';
import {
  CATEGORIAS,
  CHECKLIST_M5,
  FUENTES_PRUEBA,
  NIVELES,
  VERIFICACIONES,
  bloqueosAprobar,
  eurosACentimos,
  textoAHtml,
  type EstadoCaso,
} from '@/lib/vigia/casos';

/**
 * Ciclo de vida del caso de auditoría (doc 04 §4.5). Todas pasan por
 * `requireAuditor` (D-A06) y escriben con el cliente del usuario, así que la
 * RLS de la 0069 y sus triggers de invariantes son la última puerta: lo que
 * aquí se comprueba antes es para dar un motivo legible, no para sustituirlos.
 * Publicar llega en F2, con la copia sellada del documento oficial.
 */

const RUTA = '/admin/presupuesto/auditorias';
type Resultado = { ok: true } | { error: string };

function texto(v: FormDataEntryValue | null, max: number): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s.slice(0, max) : null;
}

function de<T extends string>(lista: readonly T[], v: FormDataEntryValue | null): T | null {
  return typeof v === 'string' && (lista as readonly string[]).includes(v) ? (v as T) : null;
}

function refrescar(id?: string) {
  revalidatePath(RUTA);
  if (id) revalidatePath(`${RUTA}/${id}`);
}

/** Abre (o reabre) el caso de un envío de la bandeja y lleva a su ficha. */
export async function abrirCaso(sourceId: string) {
  const { supabase, user } = await requireAuditor(RUTA);

  const { data: existente } = await supabase.from('watchdog_alerts').select('id').eq('source_id', sourceId).maybeSingle();
  if (existente) redirect(`${RUTA}/${existente.id}`);

  const { data: fuente, error: errFuente } = await supabase
    .from('watchdog_sources')
    .select('id, message_text, permalink')
    .eq('id', sourceId)
    .single();
  if (errFuente || !fuente) throw new Error('No se encuentra el envío.');

  const resumen = (fuente.message_text || fuente.permalink || 'Caso sin texto').trim();
  const { data: caso, error } = await supabase
    .from('watchdog_alerts')
    .insert({
      title: resumen.slice(0, 120),
      description: resumen.slice(0, 4000),
      status: 'flagged',
      source_id: sourceId,
      created_by: user.id,
    })
    .select('id')
    .single();
  if (error || !caso) throw new Error(`No se pudo abrir el caso: ${error?.message}`);

  await supabase
    .from('watchdog_sources')
    .update({ status: 'en_revision', updated_at: new Date().toISOString(), updated_by: user.id })
    .eq('id', sourceId);
  await registrarAuditoria(supabase, { actorId: user.id, action: 'vigia.open', entity: 'watchdog_alerts', entityId: caso.id });

  refrescar();
  redirect(`${RUTA}/${caso.id}`);
}

/** Alta manual: un reel o enlace que no llegó por el bot. */
export async function altaManual(formData: FormData) {
  const { supabase, user } = await requireAuditor(RUTA);
  const permalink = texto(formData.get('permalink'), 1000);
  const nota = texto(formData.get('nota'), 4000);
  if (!permalink || !/^https?:\/\//i.test(permalink)) throw new Error('Pega un enlace que empiece por http(s)://');

  const { data: fuente, error } = await supabase
    .from('watchdog_sources')
    .insert({ kind: 'manual_url', permalink, message_text: nota ? `${nota}\n${permalink}` : permalink, created_by: user.id })
    .select('id')
    .single();
  if (error || !fuente) throw new Error(`No se pudo guardar el enlace: ${error?.message}`);

  await abrirCaso(fuente.id);
}

/** Guarda los datos, los hechos y la valoración. No cambia el estado. */
export async function guardarCaso(id: string, formData: FormData): Promise<Resultado> {
  const { supabase, user } = await requireAuditor(RUTA);

  const titulo = texto(formData.get('title'), 200);
  if (!titulo) return { error: 'El título no puede quedar vacío.' };

  const importeDenunciado = texto(formData.get('importe_denunciado'), 40);
  const importeOficial = texto(formData.get('importe_oficial'), 40);
  const centDenunciado = eurosACentimos(importeDenunciado);
  const centOficial = eurosACentimos(importeOficial);
  if (importeDenunciado && centDenunciado == null) return { error: 'No entiendo el importe del reel.' };
  if (importeOficial && centOficial == null) return { error: 'No entiendo el importe oficial.' };

  const fecha = texto(formData.get('fecha_adjudicacion'), 10);
  if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: 'Fecha no válida.' };

  const cambios = {
    title: titulo,
    organismo: texto(formData.get('organismo'), 300),
    organismo_nivel: de(NIVELES, formData.get('organismo_nivel')),
    adjudicatario: texto(formData.get('adjudicatario'), 300),
    adjudicatario_nif: texto(formData.get('adjudicatario_nif'), 20)?.toUpperCase() ?? null,
    es_persona_fisica: formData.get('es_persona_fisica') === 'on',
    categoria: de(CATEGORIAS, formData.get('categoria')),
    importe_denunciado_cents: centDenunciado,
    importe_oficial_cents: centOficial,
    fecha_adjudicacion: fecha,
    verificacion: de(VERIFICACIONES, formData.get('verificacion')),
    hechos_html: textoAHtml(texto(formData.get('hechos'), 8000)),
    valoracion_html: textoAHtml(texto(formData.get('valoracion'), 8000)),
    replica_texto: texto(formData.get('replica_texto'), 8000),
  };

  // Un caso ya verificado no se retoca a escondidas: hay que reabrirlo.
  const { data: actual } = await supabase.from('watchdog_alerts').select('status').eq('id', id).single();
  if (!actual) return { error: 'Caso no encontrado.' };
  if (['verified', 'published', 'dismissed'].includes(actual.status)) {
    return { error: 'Este caso está cerrado. Reábrelo para editarlo.' };
  }

  const { error } = await supabase
    .from('watchdog_alerts')
    .update({ ...cambios, status: actual.status === 'flagged' ? 'analyzed' : actual.status })
    .eq('id', id);
  if (error) return { error: error.message };

  await registrarAuditoria(supabase, { actorId: user.id, action: 'vigia.edit', entity: 'watchdog_alerts', entityId: id });
  refrescar(id);
  return { ok: true };
}

export async function anadirPrueba(alertId: string, formData: FormData): Promise<Resultado> {
  const { supabase, user } = await requireAuditor(RUTA);
  const url = texto(formData.get('url'), 1000);
  if (!url || !/^https?:\/\//i.test(url)) return { error: 'La prueba necesita el enlace a la fuente oficial.' };
  const fuente = de(FUENTES_PRUEBA, formData.get('source_kind'));
  if (!fuente) return { error: 'Elige de qué fuente es.' };
  const importe = texto(formData.get('importe'), 40);
  const cent = eurosACentimos(importe);
  if (importe && cent == null) return { error: 'No entiendo el importe.' };
  const fecha = texto(formData.get('fecha'), 10);

  const { error } = await supabase.from('watchdog_evidence').insert({
    alert_id: alertId,
    source_kind: fuente,
    url,
    expediente: texto(formData.get('expediente'), 200),
    organo: texto(formData.get('organo'), 300),
    adjudicatario: texto(formData.get('adjudicatario'), 300),
    nif: texto(formData.get('nif'), 20)?.toUpperCase() ?? null,
    importe_cents: cent,
    fecha: fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : null,
    notes: texto(formData.get('notes'), 2000),
    matched_by: 'manual',
    created_by: user.id,
  });
  if (error) return { error: error.message };
  await registrarAuditoria(supabase, { actorId: user.id, action: 'vigia.evidence_add', entity: 'watchdog_alerts', entityId: alertId, meta: { fuente, url } });
  refrescar(alertId);
  return { ok: true };
}

/** Marca una prueba como la principal del caso (solo puede haber una). */
export async function marcarPrincipal(alertId: string, evidenceId: string): Promise<Resultado> {
  const { supabase, user } = await requireAuditor(RUTA);
  const { error: e1 } = await supabase.from('watchdog_evidence').update({ selected: false }).eq('alert_id', alertId).eq('selected', true);
  if (e1) return { error: e1.message };
  const { error } = await supabase.from('watchdog_evidence').update({ selected: true }).eq('id', evidenceId).eq('alert_id', alertId);
  if (error) return { error: error.message };
  await registrarAuditoria(supabase, { actorId: user.id, action: 'vigia.evidence_select', entity: 'watchdog_alerts', entityId: alertId, meta: { evidenceId } });
  refrescar(alertId);
  return { ok: true };
}

export async function borrarPrueba(alertId: string, evidenceId: string): Promise<Resultado> {
  const { supabase, user } = await requireAuditor(RUTA);
  const { data: caso } = await supabase.from('watchdog_alerts').select('status').eq('id', alertId).single();
  if (caso && ['verified', 'published'].includes(caso.status)) return { error: 'Reabre el caso antes de quitar pruebas.' };
  const { error } = await supabase.from('watchdog_evidence').delete().eq('id', evidenceId).eq('alert_id', alertId);
  if (error) return { error: error.message };
  await registrarAuditoria(supabase, { actorId: user.id, action: 'vigia.evidence_remove', entity: 'watchdog_alerts', entityId: alertId, meta: { evidenceId } });
  refrescar(alertId);
  return { ok: true };
}

/** Anota que se ha pedido réplica (el correo se manda fuera, M6). */
export async function pedirReplica(id: string): Promise<Resultado> {
  const { supabase, user } = await requireAuditor(RUTA);
  const { error } = await supabase
    .from('watchdog_alerts')
    .update({ status: 'pending_reply', replica_solicitada_at: new Date().toISOString() })
    .eq('id', id)
    .in('status', ['flagged', 'analyzed']);
  if (error) return { error: error.message };
  await registrarAuditoria(supabase, { actorId: user.id, action: 'vigia.reply_requested', entity: 'watchdog_alerts', entityId: id });
  refrescar(id);
  return { ok: true };
}

/** Aprobar = el auditor firma: pasa a `verified` con su nombre y la fecha (M1). */
export async function aprobarCaso(id: string, checklist: string[]): Promise<Resultado> {
  const { supabase, user } = await requireAuditor(RUTA);
  const [{ data: caso }, { count }] = await Promise.all([
    supabase
      .from('watchdog_alerts')
      .select('status, adjudicatario, es_persona_fisica, replica_solicitada_at, hechos_html, verificacion, source_id')
      .eq('id', id)
      .single(),
    supabase.from('watchdog_evidence').select('id', { count: 'exact', head: true }).eq('alert_id', id).eq('selected', true),
  ]);
  if (!caso) return { error: 'Caso no encontrado.' };

  const marcados = checklist.filter((c) => CHECKLIST_M5.some((m) => m.id === c));
  const motivos = bloqueosAprobar({ ...caso, status: caso.status as EstadoCaso }, (count ?? 0) > 0, marcados);
  if (motivos.length) return { error: motivos.join(' ') };

  const { error } = await supabase
    .from('watchdog_alerts')
    .update({ status: 'verified', verified_by: user.id, verified_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { error: error.message };

  if (caso.source_id) {
    await supabase
      .from('watchdog_sources')
      .update({ status: 'procesado', updated_at: new Date().toISOString(), updated_by: user.id })
      .eq('id', caso.source_id);
  }
  await registrarAuditoria(supabase, { actorId: user.id, action: 'vigia.verify', entity: 'watchdog_alerts', entityId: id, meta: { checklist: marcados } });
  refrescar(id);
  return { ok: true };
}

export async function descartarCaso(id: string, motivo: string): Promise<Resultado> {
  const { supabase, user } = await requireAuditor(RUTA);
  const razon = motivo.trim().slice(0, 2000);
  if (!razon) return { error: 'Descartar exige motivo.' };
  const { data: caso, error } = await supabase
    .from('watchdog_alerts')
    .update({ status: 'dismissed', dismiss_reason: razon })
    .eq('id', id)
    .neq('status', 'published')
    .select('source_id')
    .single();
  if (error) return { error: error.message };
  if (caso?.source_id) {
    await supabase
      .from('watchdog_sources')
      .update({ status: 'descartado', updated_at: new Date().toISOString(), updated_by: user.id })
      .eq('id', caso.source_id);
  }
  await registrarAuditoria(supabase, { actorId: user.id, action: 'vigia.dismiss', entity: 'watchdog_alerts', entityId: id, meta: { motivo: razon } });
  refrescar(id);
  return { ok: true };
}

/** Vuelve a análisis un caso verificado o descartado (no uno publicado: eso será rectificar, F2). */
export async function reabrirCaso(id: string): Promise<Resultado> {
  const { supabase, user } = await requireAuditor(RUTA);
  const { error } = await supabase
    .from('watchdog_alerts')
    .update({ status: 'analyzed', verified_by: null, verified_at: null, dismiss_reason: null })
    .eq('id', id)
    .in('status', ['verified', 'dismissed']);
  if (error) return { error: error.message };
  await registrarAuditoria(supabase, { actorId: user.id, action: 'vigia.reopen', entity: 'watchdog_alerts', entityId: id });
  refrescar(id);
  return { ok: true };
}
