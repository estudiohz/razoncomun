import type { SupabaseClient } from '@supabase/supabase-js';
import { enviarCorreo } from '@/lib/email/enviar';
import { urlSitio } from '@/lib/supabase/env';
import { urlBaja } from './baja';
import { correoEncuestaInicio, correoEncuestaRecordatorio, type CorreoRenderizado, type DatosCorreoEncuesta } from './plantillas';

/**
 * Campañas de la encuesta del mes (docs/tecnico/newsletter.md, N1).
 *
 * `crearCampana` congela la lista de destinatarios en `newsletter_envios`;
 * `procesarCola` va vaciándola sin pasar del cupo diario (D-N5). Las dos las
 * llama el cron de /api/newsletter/cron.
 */

export type TipoCampana = 'encuesta_inicio' | 'encuesta_recordatorio';

/** Brevo gratis: 300/día compartidos con el login. Se reservan 50. */
export const LIMITE_DIARIO = Number(process.env.NEWSLETTER_LIMITE_DIARIO ?? 250);

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIA = 86_400_000;

/** 'YYYY-MM' del mes en curso en Madrid. */
export function mesDe(ahora: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit' }).format(ahora);
}

export const nombreMes = (mes: string) => MESES[Number(mes.slice(5, 7)) - 1];

export function fechaCierre(iso: string): string {
  return new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'long' }).format(new Date(iso));
}

export const diasHasta = (iso: string, ahora: Date) => Math.max(1, Math.ceil((new Date(iso).getTime() - ahora.getTime()) / DIA));

interface Encuesta {
  id: string;
  title: string;
  audience: 'public' | 'registered' | 'member';
  opens_at: string;
  closes_at: string;
  total: number;
}

async function encuestaDelMes(admin: SupabaseClient, mes: string): Promise<Encuesta | null> {
  const { data } = await admin
    .from('surveys')
    .select('id, title, audience, opens_at, closes_at, survey_questions(count)')
    .eq('featured_month', `${mes}-01`)
    .maybeSingle();
  if (!data) return null;
  const total = (data.survey_questions as unknown as { count: number }[] | null)?.[0]?.count ?? 0;
  return { id: data.id, title: data.title, audience: data.audience, opens_at: data.opens_at, closes_at: data.closes_at, total };
}

/** Lee todas las filas aunque pasen del máximo de PostgREST (1000). */
async function todas<T>(consulta: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await consulta(desde, desde + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

/** user_id → preguntas distintas respondidas en la encuesta. */
export async function respondidasPorUsuario(admin: SupabaseClient, surveyId: string, userIds?: string[]): Promise<Map<string, number>> {
  const filas = await todas<{ user_id: string; question_id: string }>((a, b) => {
    let q = admin.from('survey_responses').select('user_id, question_id').eq('survey_id', surveyId).not('user_id', 'is', null);
    if (userIds) q = q.in('user_id', userIds);
    return q.range(a, b);
  });
  const sets = new Map<string, Set<string>>();
  for (const f of filas) {
    if (!sets.has(f.user_id)) sets.set(f.user_id, new Set());
    sets.get(f.user_id)!.add(f.question_id);
  }
  return new Map([...sets].map(([u, s]) => [u, s.size]));
}

function renderizar(tipo: TipoCampana, d: DatosCorreoEncuesta): CorreoRenderizado {
  return tipo === 'encuesta_inicio' ? correoEncuestaInicio(d) : correoEncuestaRecordatorio(d);
}

function datos(enc: Encuesta, mes: string, ahora: Date, nombre: string | null, respondidas: number, baja: string): DatosCorreoEncuesta {
  return {
    sitio: urlSitio().replace(/\/$/, ''),
    nombre,
    mes: nombreMes(mes),
    tituloEncuesta: enc.title,
    cierre: fechaCierre(enc.closes_at),
    diasRestantes: diasHasta(enc.closes_at, ahora),
    preguntasPendientes: Math.max(0, enc.total - respondidas),
    preguntasTotales: enc.total,
    urlBaja: baja,
  };
}

export type ResultadoCrear =
  | { creada: true; id: string; destinatarios: number }
  | { creada: false; motivo: 'sin_encuesta' | 'no_abierta' | 'cerrada' | 'ya_existe' | 'sin_destinatarios'; id?: string };

export async function crearCampana(admin: SupabaseClient, tipo: TipoCampana, ahora = new Date()): Promise<ResultadoCrear> {
  const mes = mesDe(ahora);
  const enc = await encuestaDelMes(admin, mes);
  // D-N6: sin encuesta destacada este mes, no se envía nada.
  if (!enc) return { creada: false, motivo: 'sin_encuesta' };
  if (ahora.getTime() < new Date(enc.opens_at).getTime()) return { creada: false, motivo: 'no_abierta' };
  if (ahora.getTime() >= new Date(enc.closes_at).getTime()) return { creada: false, motivo: 'cerrada' };

  const { data: existente } = await admin
    .from('newsletter_campaigns')
    .select('id')
    .eq('tipo', tipo)
    .eq('mes', `${mes}-01`)
    .maybeSingle();
  if (existente) return { creada: false, motivo: 'ya_existe', id: existente.id };

  let perfiles = await todas<{ id: string; email: string; level: string }>((a, b) => {
    let q = admin
      .from('profiles')
      .select('id, email, level')
      .eq('avisos_correo', true)
      .not('email', 'is', null)
      .is('anonymized_at', null);
    // Una encuesta solo de socios no se anuncia a quien no puede contestarla.
    if (enc.audience === 'member') q = q.in('level', ['member', 'verified']);
    return q.order('id').range(a, b);
  });

  if (tipo === 'encuesta_recordatorio') {
    const respondidas = await respondidasPorUsuario(admin, enc.id);
    perfiles = perfiles.filter((p) => (respondidas.get(p.id) ?? 0) < enc.total);
  }
  if (perfiles.length === 0) return { creada: false, motivo: 'sin_destinatarios' };

  // Contenido congelado con un destinatario de muestra (D-N7).
  const muestra = renderizar(tipo, datos(enc, mes, ahora, 'Nombre', 0, `${urlSitio()}/baja-avisos`));
  const { data: campana, error } = await admin
    .from('newsletter_campaigns')
    .insert({
      tipo,
      mes: `${mes}-01`,
      survey_id: enc.id,
      asunto: muestra.asunto,
      html: muestra.html,
      texto: muestra.texto,
      destinatarios: perfiles.length,
    })
    .select('id')
    .single();
  // Carrera con otro cron: la restricción única ya la ha creado el otro.
  if (error?.code === '23505') return { creada: false, motivo: 'ya_existe' };
  if (error) throw error;

  for (let i = 0; i < perfiles.length; i += 500) {
    const { error: e } = await admin.from('newsletter_envios').upsert(
      perfiles.slice(i, i + 500).map((p) => ({ campaign_id: campana.id, user_id: p.id, email: p.email })),
      { onConflict: 'campaign_id,user_id', ignoreDuplicates: true },
    );
    if (e) throw e;
  }
  return { creada: true, id: campana.id, destinatarios: perfiles.length };
}

export interface ResultadoCola {
  cupo: number;
  enviados: number;
  fallidos: number;
  omitidos: number;
  pendientes: number;
}

export async function procesarCola(admin: SupabaseClient, ahora = new Date()): Promise<ResultadoCola> {
  const inicioDia = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate())).toISOString();
  const { count: hoy } = await admin
    .from('newsletter_envios')
    .select('id', { count: 'exact', head: true })
    .gte('enviado_at', inicioDia);
  const cupo = Math.max(0, LIMITE_DIARIO - (hoy ?? 0));
  const r: ResultadoCola = { cupo, enviados: 0, fallidos: 0, omitidos: 0, pendientes: 0 };

  if (cupo > 0) {
    const { data: lote, error } = await admin
      .from('newsletter_envios')
      .select('id, user_id, email, intentos, campaign_id, campana:newsletter_campaigns!inner(tipo, mes, survey_id, estado)')
      .eq('estado', 'pendiente')
      .eq('campana.estado', 'enviando')
      .order('creado_at')
      .limit(cupo);
    if (error) throw error;

    type Fila = { id: string; user_id: string | null; email: string; intentos: number; campaign_id: string; campana: { tipo: TipoCampana; mes: string; survey_id: string | null } };
    const filas = (lote ?? []) as unknown as Fila[];
    const ids = filas.map((f) => f.user_id).filter((x): x is string => !!x);
    const { data: perfiles } = ids.length
      ? await admin.from('profiles').select('id, first_name, display_name, avisos_correo, anonymized_at').in('id', ids)
      : { data: [] };
    const perfil = new Map((perfiles ?? []).map((p) => [p.id as string, p]));

    const encuestas = new Map<string, Encuesta | null>();
    const respondidas = new Map<string, Map<string, number>>();
    for (const sid of new Set(filas.map((f) => f.campana.mes))) {
      encuestas.set(sid, await encuestaDelMes(admin, sid.slice(0, 7)));
    }
    for (const enc of encuestas.values()) {
      if (enc) respondidas.set(enc.id, await respondidasPorUsuario(admin, enc.id, ids));
    }

    for (const f of filas) {
      const p = f.user_id ? perfil.get(f.user_id) : null;
      const enc = encuestas.get(f.campana.mes) ?? null;
      const hechas = enc && f.user_id ? (respondidas.get(enc.id)?.get(f.user_id) ?? 0) : 0;
      // Lo que cambió desde que se creó la campaña: se dio de baja, borró la
      // cuenta, la encuesta ya cerró o (recordatorio) ya la ha terminado.
      const motivo = !p || p.anonymized_at
        ? 'cuenta dada de baja'
        : p.avisos_correo === false
          ? 'baja de avisos'
          : !enc || ahora.getTime() >= new Date(enc.closes_at).getTime()
            ? 'encuesta cerrada'
            : f.campana.tipo === 'encuesta_recordatorio' && hechas >= enc.total
              ? 'ya participó'
              : null;
      if (motivo) {
        await admin.from('newsletter_envios').update({ estado: 'omitido', error: motivo }).eq('id', f.id);
        r.omitidos++;
        continue;
      }

      const baja = urlBaja(urlSitio(), f.user_id!) ?? `${urlSitio()}/panel/perfil`;
      const correo = renderizar(f.campana.tipo, datos(enc!, f.campana.mes.slice(0, 7), ahora, (p!.first_name || p!.display_name) ?? null, hechas, baja));
      const res = await enviarCorreo({
        para: f.email,
        ...correo,
        cabeceras: {
          'List-Unsubscribe': `<${baja.replace('/baja-avisos?', '/api/newsletter/baja?')}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          // Brevo lo devuelve en sus webhooks (N2): así se casa cada evento con su envío.
          'X-Mailin-custom': JSON.stringify({ envio: f.id, campana: f.campaign_id }),
          'X-Mailin-Tag': f.campana.tipo,
        },
      });
      const intentos = f.intentos + 1;
      if (res.enviado) {
        await admin
          .from('newsletter_envios')
          .update({ estado: 'enviado', enviado_at: new Date().toISOString(), message_id: res.messageId ?? null, intentos, error: null })
          .eq('id', f.id);
        r.enviados++;
      } else {
        // Tres intentos (uno por hora) antes de darlo por perdido.
        await admin
          .from('newsletter_envios')
          .update({ estado: intentos >= 3 ? 'fallido' : 'pendiente', intentos, error: res.motivo ?? 'error' })
          .eq('id', f.id);
        r.fallidos++;
        if (res.motivo === 'smtp_no_configurado') break;
      }
    }
  }

  // Campañas que se han quedado sin pendientes → enviadas.
  const { data: abiertas } = await admin.from('newsletter_campaigns').select('id').eq('estado', 'enviando');
  for (const c of abiertas ?? []) {
    const { count } = await admin
      .from('newsletter_envios')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', c.id)
      .eq('estado', 'pendiente');
    r.pendientes += count ?? 0;
    if (!count) await admin.from('newsletter_campaigns').update({ estado: 'enviada', enviada_at: new Date().toISOString() }).eq('id', c.id);
  }
  return r;
}

/** Correo de prueba a una dirección, sin campaña ni cola. */
export async function enviarPrueba(admin: SupabaseClient, tipo: TipoCampana, para: string, ahora = new Date()) {
  const mes = mesDe(ahora);
  const enc = (await encuestaDelMes(admin, mes)) ?? {
    id: '', title: 'Encuesta de ejemplo', audience: 'registered' as const,
    opens_at: ahora.toISOString(), closes_at: new Date(ahora.getTime() + 5 * DIA).toISOString(), total: 8,
  };
  const correo = renderizar(tipo, datos(enc, mes, ahora, 'Sergio', tipo === 'encuesta_recordatorio' ? 3 : 0, `${urlSitio()}/baja-avisos`));
  return enviarCorreo({ para, ...correo, asunto: `[PRUEBA] ${correo.asunto}` });
}
