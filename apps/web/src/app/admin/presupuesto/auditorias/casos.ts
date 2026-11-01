'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAuditor } from '@/lib/admin/guard';
import { registrarAuditoria } from '@/lib/admin/audit';
import { createAdminClient } from '@/lib/supabase/admin';
import { BUCKET_COPIAS, guardarCopia } from '@/lib/vigia/copias';
import { copiarOrigen, verificarEnFuentes } from '@/lib/vigia/verificar';
import {
  CATEGORIAS,
  CHECKLIST_M5,
  FUENTES_PRUEBA,
  NIVELES,
  VERIFICACIONES,
  bloqueosAprobar,
  eurosACentimos,
  autorPorDefecto,
  limpiarUrlReel,
  normalizarAutor,
  perfilDeAutor,
  textoAHtml,
  type EstadoCaso,
} from '@/lib/vigia/casos';
import { ESTADOS_SOLICITUD, redactarSolicitud } from '@/lib/vigia/transparencia';
import { DEPARTAMENTOS } from '@/lib/participacion/departments';
import { generarSlugUnico } from '@/lib/participacion/proposals';
import { slugificar } from '@/lib/blog/markdown';

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
      reel_url: limpiarUrlReel(fuente.permalink),
      reel_autor: autorPorDefecto(fuente.permalink),
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
    reel_url: limpiarUrlReel(texto(formData.get('reel_url'), 1000)),
    reel_autor: normalizarAutor(texto(formData.get('reel_autor'), 120)),
    reel_autor_url: perfilDeAutor(normalizarAutor(texto(formData.get('reel_autor'), 120))),
  };
  if (texto(formData.get('reel_url'), 1000) && !cambios.reel_url) return { error: 'El enlace del reel no es válido.' };

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
      .select('status, adjudicatario, es_persona_fisica, replica_solicitada_at, hechos_html, verificacion, source_id, reel_url, reel_autor')
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

// ── Caso → propuesta ────────────────────────────────────────────────────────

/**
 * Convierte el caso en una propuesta del tablero, enlazada a su origen
 * (`source_alert_id`). Nace como BORRADOR: un editor la revisa y la abre a
 * votación desde /admin/participacion, como las del RC-bot.
 */
export async function crearPropuestaDesdeCaso(alertId: string, formData: FormData): Promise<Resultado & { slug?: string }> {
  const { supabase, user } = await requireAuditor(RUTA);
  const titulo = texto(formData.get('titulo'), 200);
  const cuerpo = texto(formData.get('cuerpo'), 8000);
  const departamento = de(DEPARTAMENTOS, formData.get('departamento'));
  if (!titulo || !cuerpo || !departamento) return { error: 'Faltan título, texto o departamento.' };
  if (cuerpo.length < 40) return { error: 'El texto de la propuesta es demasiado corto.' };

  const { data: ya } = await supabase.from('proposals').select('id').eq('source_alert_id', alertId).limit(1);
  if (ya?.length) return { error: 'Este caso ya tiene una propuesta.' };

  const slug = await generarSlugUnico(supabase, titulo);
  const { data, error } = await supabase
    .from('proposals')
    .insert({
      title: titulo,
      body: textoAHtml(cuerpo),
      body_format: 'html',
      department: departamento,
      question: texto(formData.get('pregunta'), 300),
      author_id: user.id,
      status: 'draft',
      slug,
      source_alert_id: alertId,
    })
    .select('id, slug')
    .single();
  if (error || !data) return { error: error?.message ?? 'No se pudo crear la propuesta.' };

  await registrarAuditoria(supabase, {
    actorId: user.id,
    action: 'vigia.proposal_created',
    entity: 'watchdog_alerts',
    entityId: alertId,
    meta: { proposalId: data.id },
  });
  refrescar(alertId);
  return { ok: true, slug: data.slug ?? data.id };
}

// ── Caso ↔ partidas del simulador ───────────────────────────────────────────

export async function vincularPartida(alertId: string, partidaId: string, nota: string): Promise<Resultado> {
  const { supabase, user } = await requireAuditor(RUTA);
  if (!partidaId) return { error: 'Elige una partida.' };
  const { error } = await supabase
    .from('watchdog_alert_partidas')
    .upsert({ alert_id: alertId, partida_id: partidaId, nota: nota.trim().slice(0, 1000) || null, created_by: user.id });
  if (error) return { error: error.message };
  await registrarAuditoria(supabase, { actorId: user.id, action: 'vigia.partida_link', entity: 'watchdog_alerts', entityId: alertId, meta: { partidaId } });
  refrescar(alertId);
  return { ok: true };
}

export async function desvincularPartida(alertId: string, partidaId: string): Promise<Resultado> {
  const { supabase, user } = await requireAuditor(RUTA);
  const { error } = await supabase.from('watchdog_alert_partidas').delete().eq('alert_id', alertId).eq('partida_id', partidaId);
  if (error) return { error: error.message };
  await registrarAuditoria(supabase, { actorId: user.id, action: 'vigia.partida_unlink', entity: 'watchdog_alerts', entityId: alertId, meta: { partidaId } });
  refrescar(alertId);
  return { ok: true };
}

// ── Solicitudes de transparencia ────────────────────────────────────────────

/** Abre una solicitud en borrador, ya redactada con los datos del caso. */
export async function prepararSolicitud(alertId: string): Promise<Resultado> {
  const { supabase, user } = await requireAuditor(RUTA);
  const [{ data: caso }, { data: principal }] = await Promise.all([
    supabase
      .from('watchdog_alerts')
      .select('organismo, adjudicatario, adjudicatario_nif, importe_oficial_cents, fecha_adjudicacion')
      .eq('id', alertId)
      .single(),
    supabase.from('watchdog_evidence').select('source_kind, expediente, url').eq('alert_id', alertId).eq('selected', true).maybeSingle(),
  ]);
  if (!caso) return { error: 'Caso no encontrado.' };

  const expediente = principal?.expediente
    ? `${principal.source_kind === 'bdns' ? 'BDNS ' : ''}${principal.expediente}`
    : null;
  const { asunto, texto: cuerpo } = redactarSolicitud({ ...caso, expediente, urlOficial: principal?.url ?? null });
  const { error } = await supabase.from('watchdog_transparency_requests').insert({
    alert_id: alertId,
    organismo: caso.organismo ?? 'Organismo por determinar',
    asunto,
    texto: cuerpo,
    created_by: user.id,
  });
  if (error) return { error: error.message };
  await registrarAuditoria(supabase, { actorId: user.id, action: 'vigia.transparency_draft', entity: 'watchdog_alerts', entityId: alertId });
  refrescar(alertId);
  return { ok: true };
}

function fechaODe(v: FormDataEntryValue | null): string | null {
  const s = texto(v, 10);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/** Guarda el seguimiento: estado, número de registro, fechas y respuesta. */
export async function guardarSolicitud(alertId: string, id: string, formData: FormData): Promise<Resultado> {
  const { supabase, user } = await requireAuditor(RUTA);
  const estado = de(ESTADOS_SOLICITUD, formData.get('estado'));
  if (!estado) return { error: 'Estado no válido.' };
  const presentada = fechaODe(formData.get('presentada_at'));
  if (estado !== 'borrador' && !presentada) return { error: 'Indica la fecha en que se presentó.' };
  const respuestaUrl = texto(formData.get('respuesta_url'), 1000);
  if (respuestaUrl && !/^https?:\/\//i.test(respuestaUrl)) return { error: 'El enlace de la respuesta debe empezar por http(s)://' };

  const { error } = await supabase
    .from('watchdog_transparency_requests')
    .update({
      estado,
      organismo: texto(formData.get('organismo'), 300) ?? undefined,
      asunto: texto(formData.get('asunto'), 250) ?? undefined,
      texto: texto(formData.get('texto'), 10000) ?? undefined,
      presentada_at: presentada,
      numero_registro: texto(formData.get('numero_registro'), 100),
      ampliada_at: fechaODe(formData.get('ampliada_at')),
      respuesta_at: fechaODe(formData.get('respuesta_at')),
      respuesta_texto: texto(formData.get('respuesta_texto'), 10000),
      respuesta_url: respuestaUrl,
      reclamacion_at: fechaODe(formData.get('reclamacion_at')),
      reclamacion_numero: texto(formData.get('reclamacion_numero'), 100),
      notas: texto(formData.get('notas'), 4000),
    })
    .eq('id', id)
    .eq('alert_id', alertId);
  if (error) return { error: error.message };
  await registrarAuditoria(supabase, { actorId: user.id, action: 'vigia.transparency_update', entity: 'watchdog_alerts', entityId: alertId, meta: { solicitud: id, estado } });
  refrescar(alertId);
  return { ok: true };
}

// ── Fuentes oficiales y copias de respaldo (0074) ───────────────────────────

/** "Buscar en fuentes oficiales": BDNS con lo que ya sabe el caso. */
export async function buscarEnFuentes(alertId: string): Promise<Resultado & { resumen?: string }> {
  const { supabase, user } = await requireAuditor(RUTA);
  const { data: caso } = await supabase
    .from('watchdog_alerts')
    .select(
      'title, organismo, adjudicatario, adjudicatario_nif, importe_denunciado_cents, importe_oficial_cents, hechos_html, fuente:watchdog_sources(transcript, message_text)',
    )
    .eq('id', alertId)
    .single();
  if (!caso) return { error: 'Caso no encontrado.' };
  const fuente = (Array.isArray(caso.fuente) ? caso.fuente[0] : caso.fuente) as
    | { transcript: string | null; message_text: string | null }
    | null;

  const r = await verificarEnFuentes(
    createAdminClient(),
    alertId,
    {
      nif: caso.adjudicatario_nif,
      beneficiario: caso.adjudicatario,
      importeCents: caso.importe_oficial_cents ?? caso.importe_denunciado_cents,
      organismo: caso.organismo,
      texto: [caso.title, caso.hechos_html, fuente?.transcript, fuente?.message_text].filter(Boolean).join(' '),
    },
    user.id,
  );
  await registrarAuditoria(supabase, {
    actorId: user.id,
    action: 'vigia.search_sources',
    entity: 'watchdog_alerts',
    entityId: alertId,
    meta: { encontrados: r.encontrados, claro: r.claro, copias: r.copias, errores: r.errores },
  });
  refrescar(alertId);
  if (!r.encontrados) {
    return { error: r.errores.length ? `No se pudo consultar la BDNS: ${r.errores[0]}` : 'No hay coincidencias en la BDNS con estos datos. Prueba a completar el adjudicatario o el NIF.' };
  }
  return {
    ok: true,
    resumen: `${r.encontrados} candidato${r.encontrados === 1 ? '' : 's'} en la BDNS${r.claro ? ', uno claro: rellenado y marcado como principal' : ''}. ${r.copias} copia${r.copias === 1 ? '' : 's'} sellada${r.copias === 1 ? '' : 's'}.`,
  };
}

/** Copia sellada de una prueba añadida a mano. */
export async function copiarPrueba(alertId: string, evidenceId: string): Promise<Resultado> {
  const { supabase, user } = await requireAuditor(RUTA);
  const { data: ev } = await supabase.from('watchdog_evidence').select('url').eq('id', evidenceId).eq('alert_id', alertId).single();
  if (!ev) return { error: 'Prueba no encontrada.' };
  try {
    await guardarCopia(createAdminClient(), { alertId, evidenceId, tipo: 'prueba', url: ev.url, createdBy: user.id });
  } catch (e) {
    return { error: `No se pudo copiar: ${e instanceof Error ? e.message : e}` };
  }
  await registrarAuditoria(supabase, { actorId: user.id, action: 'vigia.snapshot', entity: 'watchdog_alerts', entityId: alertId, meta: { evidenceId } });
  refrescar(alertId);
  return { ok: true };
}

/** Copia de respaldo del origen (artículo o web). */
export async function copiarOrigenCaso(alertId: string): Promise<Resultado> {
  const { supabase, user } = await requireAuditor(RUTA);
  const { data: caso } = await supabase.from('watchdog_alerts').select('reel_url').eq('id', alertId).single();
  const r = await copiarOrigen(createAdminClient(), alertId, caso?.reel_url ?? null, user.id);
  if (r === 'sin_url') return { error: 'El caso no tiene enlace de origen.' };
  if (r === 'red_social') return { error: 'Es un reel: su copia es el vídeo, que guarda el bot al recibirlo.' };
  if (r !== 'copiado') return { error: `No se pudo copiar: ${r}` };
  await registrarAuditoria(supabase, { actorId: user.id, action: 'vigia.snapshot_origin', entity: 'watchdog_alerts', entityId: alertId });
  refrescar(alertId);
  return { ok: true };
}

/** Enlace temporal (10 min) para descargar una copia del bucket privado. */
export async function enlaceCopia(copiaId: string): Promise<{ url: string } | { error: string }> {
  const { supabase } = await requireAuditor(RUTA);
  // Leer la fila con el cliente del usuario: la RLS confirma que es auditor.
  const { data: copia } = await supabase.from('watchdog_copias').select('storage_path').eq('id', copiaId).single();
  if (!copia) return { error: 'Copia no encontrada.' };
  const { data, error } = await createAdminClient().storage.from(BUCKET_COPIAS).createSignedUrl(copia.storage_path, 600);
  if (error || !data) return { error: error?.message ?? 'No se pudo generar el enlace.' };
  return { url: data.signedUrl };
}

// ── Publicación y rectificación (F2, 0075) ──────────────────────────────────

/** Lo que se congela en cada versión pública (M7). Sin NIF si es persona física (minimización). */
async function fotoPublica(supabase: Awaited<ReturnType<typeof requireAuditor>>['supabase'], id: string) {
  const [{ data: c }, { data: principal }] = await Promise.all([
    supabase
      .from('watchdog_alerts')
      .select(
        'title, organismo, organismo_nivel, adjudicatario, adjudicatario_nif, es_persona_fisica, categoria, importe_oficial_cents, importe_denunciado_cents, fecha_adjudicacion, verificacion, hechos_html, valoracion_html, replica_solicitada_at, replica_texto, reel_url, reel_autor, firmado_por, verified_at, published_at, rectificado_at, rectificacion_nota',
      )
      .eq('id', id)
      .single(),
    supabase
      .from('watchdog_evidence')
      .select('source_kind, expediente, url, snapshot_sha256, snapshot_at')
      .eq('alert_id', id)
      .eq('selected', true)
      .maybeSingle(),
  ]);
  if (!c) return null;
  return { ...c, adjudicatario_nif: c.es_persona_fisica ? null : c.adjudicatario_nif, prueba: principal ?? null };
}

async function siguienteVersion(supabase: Awaited<ReturnType<typeof requireAuditor>>['supabase'], id: string) {
  const { data } = await supabase
    .from('watchdog_alert_versions')
    .select('version')
    .eq('alert_id', id)
    .order('version', { ascending: false })
    .limit(1);
  return (data?.[0]?.version ?? 0) + 1;
}

async function slugUnico(supabase: Awaited<ReturnType<typeof requireAuditor>>['supabase'], titulo: string) {
  const base = slugificar(titulo).slice(0, 90).replace(/-+$/, '') || 'caso';
  for (let i = 0; i < 20; i++) {
    const candidato = i === 0 ? base : `${base}-${i + 1}`;
    const { data } = await supabase.from('watchdog_alerts').select('id').eq('slug', candidato).maybeSingle();
    if (!data) return candidato;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/**
 * Publica un caso verificado (o lo programa). Los triggers de la 0069/0073
 * exigen firma, hechos, prueba oficial con copia sellada y origen citado: si
 * falta algo, la base de datos lo rechaza aunque se salte esta comprobación.
 */
export async function publicarCaso(id: string, fecha: string | null, sinReplicaConfirmado: boolean): Promise<Resultado> {
  const { supabase, user } = await requireAuditor(RUTA);
  const { data: caso } = await supabase
    .from('watchdog_alerts')
    .select('status, title, slug, replica_solicitada_at, adjudicatario, es_persona_fisica, verified_by')
    .eq('id', id)
    .single();
  if (!caso) return { error: 'Caso no encontrado.' };
  if (caso.status !== 'verified') return { error: 'Solo se publica un caso verificado y firmado.' };
  if (!caso.replica_solicitada_at && !sinReplicaConfirmado) {
    return { error: 'No se pidió réplica. Confirma expresamente que se publica sin ella.' };
  }

  let cuando = new Date();
  if (fecha) {
    const f = new Date(fecha);
    if (Number.isNaN(f.getTime())) return { error: 'Fecha de publicación no válida.' };
    cuando = f;
  }

  const { data: firmante } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', caso.verified_by ?? '')
    .maybeSingle();

  const { error } = await supabase
    .from('watchdog_alerts')
    .update({
      status: 'published',
      published_at: cuando.toISOString(),
      slug: caso.slug ?? (await slugUnico(supabase, caso.title)),
      firmado_por: firmante?.display_name?.trim() || 'Equipo de auditoría de Razón Común',
    })
    .eq('id', id);
  if (error) return { error: error.message };

  const foto = await fotoPublica(supabase, id);
  await supabase.from('watchdog_alert_versions').insert({
    alert_id: id,
    version: await siguienteVersion(supabase, id),
    snapshot: foto,
    reason: 'Publicación',
    changed_by: user.id,
  });
  await registrarAuditoria(supabase, {
    actorId: user.id,
    action: 'vigia.publish',
    entity: 'watchdog_alerts',
    entityId: id,
    meta: { published_at: cuando.toISOString(), sin_replica: !caso.replica_solicitada_at },
  });
  refrescar(id);
  revalidatePath('/observatorio/auditorias');
  return { ok: true };
}

/**
 * Rectificar: el caso sigue publicado pero con aviso visible y una versión
 * nueva en el historial. Deja de sumar en el contador (counts_in_total).
 */
export async function rectificarCaso(id: string, nota: string): Promise<Resultado> {
  const { supabase, user } = await requireAuditor(RUTA);
  const texto = nota.trim().slice(0, 4000);
  if (texto.length < 10) return { error: 'Explica la rectificación (es pública).' };
  const { error } = await supabase
    .from('watchdog_alerts')
    .update({ rectificado_at: new Date().toISOString(), rectificacion_nota: texto })
    .eq('id', id)
    .eq('status', 'published');
  if (error) return { error: error.message };
  await supabase.from('watchdog_alert_versions').insert({
    alert_id: id,
    version: await siguienteVersion(supabase, id),
    snapshot: await fotoPublica(supabase, id),
    reason: `Rectificación: ${texto.slice(0, 300)}`,
    changed_by: user.id,
  });
  await registrarAuditoria(supabase, { actorId: user.id, action: 'vigia.rectify', entity: 'watchdog_alerts', entityId: id, meta: { nota: texto } });
  refrescar(id);
  revalidatePath('/observatorio/auditorias');
  return { ok: true };
}

/** Retirar de la web (vuelve a «verificado»). Solo admin: es excepcional. */
export async function despublicarCaso(id: string, motivo: string): Promise<Resultado> {
  const { supabase, user, esAdmin } = await requireAuditor(RUTA);
  if (!esAdmin) return { error: 'Solo un admin puede retirar un caso publicado.' };
  if (!motivo.trim()) return { error: 'Indica el motivo.' };
  const { error } = await supabase
    .from('watchdog_alerts')
    .update({ status: 'verified', published_at: null })
    .eq('id', id)
    .eq('status', 'published');
  if (error) return { error: error.message };
  await registrarAuditoria(supabase, { actorId: user.id, action: 'vigia.unpublish', entity: 'watchdog_alerts', entityId: id, meta: { motivo: motivo.trim().slice(0, 1000) } });
  refrescar(id);
  revalidatePath('/observatorio/auditorias');
  return { ok: true };
}

/** Responde una solicitud de rectificación (plazo: 3 días). */
export async function resolverRectificacion(
  alertId: string,
  correctionId: string,
  resolucion: 'aceptada' | 'parcial' | 'rechazada',
  notaPublica: string,
): Promise<Resultado> {
  const { supabase, user } = await requireAuditor(RUTA);
  if (!['aceptada', 'parcial', 'rechazada'].includes(resolucion)) return { error: 'Resolución no válida.' };
  const { error } = await supabase
    .from('watchdog_corrections')
    .update({
      resolved_at: new Date().toISOString(),
      resolution: resolucion,
      public_note: notaPublica.trim().slice(0, 2000) || null,
      handled_by: user.id,
    })
    .eq('id', correctionId)
    .eq('alert_id', alertId);
  if (error) return { error: error.message };
  await registrarAuditoria(supabase, {
    actorId: user.id,
    action: 'vigia.correction_resolved',
    entity: 'watchdog_alerts',
    entityId: alertId,
    meta: { correctionId, resolucion },
  });
  refrescar(alertId);
  return { ok: true };
}
