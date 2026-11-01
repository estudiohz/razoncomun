import type { SupabaseClient } from '@supabase/supabase-js';
import { buscarEnBdns, concesionesDeConvocatoria, puntuarConcesion, type CandidatoBdns, type PistaBdns } from './bdns';
import { descargarAnuncio, palabrasClave, type AnuncioBoe } from './boe';
import { esRedSocial, guardarCopia } from './copias';
import { esNifPersonaFisica } from './rastro';

/**
 * Comprobación contra la fuente oficial (doc 05, T1.2): busca el expediente,
 * lo añade como prueba con su enlace oficial y guarda la copia sellada del
 * registro (sha256). Si un candidato encaja con claridad, rellena el caso con
 * los datos OFICIALES y lo marca como prueba principal. El auditor revisa y
 * firma; esto le ahorra la búsqueda, no la decisión.
 */

export const SCORE_CLARO = 0.7;

export interface ResultadoVerificacion {
  encontrados: number;
  claro: boolean;
  copias: number;
  errores: string[];
}

function elegirClaro(c: CandidatoBdns[]): CandidatoBdns | null {
  const [a, b] = c;
  return a && a.score >= SCORE_CLARO && (!b || a.score - b.score >= 0.1) ? a : null;
}

/**
 * `codigoBdns`: si ya se sabe la convocatoria (p. ej. porque la cita El
 * Rastro del Dinero), se va directo a ella y se confirma contra la BDNS.
 */
export async function verificarEnFuentes(
  admin: SupabaseClient,
  alertId: string,
  pista: PistaBdns & { codigoBdns?: string | null; expediente?: string | null },
  createdBy: string | null = null,
): Promise<ResultadoVerificacion> {
  const errores: string[] = [];
  let candidatos: CandidatoBdns[] = [];

  if (pista.codigoBdns) {
    try {
      const lista = await concesionesDeConvocatoria(pista.codigoBdns);
      candidatos = lista
        .map((c) => puntuarConcesion(c, pista))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
      // La convocatoria la ha señalado una fuente fiable: basta con que el
      // beneficiario o el importe encajen para darla por clara.
      if (candidatos[0]) candidatos[0] = { ...candidatos[0], score: Math.max(candidatos[0].score, SCORE_CLARO) };
    } catch (e) {
      errores.push(`BDNS (convocatoria ${pista.codigoBdns}): ${e instanceof Error ? e.message : e}`);
    }
  }
  if (!candidatos.length) {
    try {
      candidatos = await buscarEnBdns(pista);
    } catch (e) {
      errores.push(`BDNS: ${e instanceof Error ? e.message : e}`);
    }
  }
  // Una misma concesión puede salir dos veces (p. ej. dos códigos de concesión
  // para el mismo beneficiario e importe en una convocatoria): se cuenta una.
  const vistos = new Set<string>();
  candidatos = candidatos.filter((c) => {
    const k = `${c.concesion.numeroConvocatoria}|${c.concesion.nif ?? c.concesion.beneficiario}|${c.concesion.importeCents}`;
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
  if (!candidatos.length) {
    // Sin subvención en la BDNS: se prueba en el BOE (contratos).
    try {
      const { data: existentes } = await admin.from('watchdog_evidence').select('selected').eq('alert_id', alertId);
      const boe = await buscarEnBoe(admin, pista);
      if (boe.length) {
        const r = await guardarCandidatosBoe(admin, alertId, boe, (existentes ?? []).some((e) => e.selected), createdBy);
        return { encontrados: boe.length, claro: Boolean(r.claro), copias: r.copias, errores: [...errores, ...r.errores] };
      }
    } catch (e) {
      errores.push(`BOE: ${e instanceof Error ? e.message : e}`);
    }
    return { encontrados: 0, claro: false, copias: 0, errores };
  }

  // No duplicar pruebas que ya están en el caso.
  const { data: existentes } = await admin.from('watchdog_evidence').select('url, expediente, selected').eq('alert_id', alertId);
  const yaHay = new Set((existentes ?? []).map((e) => `${e.url}|${e.expediente}`));
  const hayPrincipal = (existentes ?? []).some((e) => e.selected);
  const claro = elegirClaro(candidatos);

  let copias = 0;
  for (const cand of candidatos) {
    const c = cand.concesion;
    const expediente = `${c.numeroConvocatoria} · ${c.codConcesion}`;
    if (yaHay.has(`${c.urlConvocatoria}|${expediente}`)) continue;

    const { data: ev, error } = await admin
      .from('watchdog_evidence')
      .insert({
        alert_id: alertId,
        source_kind: 'bdns',
        expediente,
        organo: c.organo || null,
        adjudicatario: c.beneficiario,
        nif: c.nif,
        importe_cents: c.importeCents,
        fecha: c.fechaConcesion,
        url: c.urlConvocatoria,
        raw: { origen: 'bdns', urlBases: c.urlBases, urlConcesiones: c.urlConcesiones, ...c.raw },
        match_score: cand.score,
        matched_by: 'auto',
        selected: cand === claro && !hayPrincipal,
        notes: [
          'Encontrado en la BDNS.',
          c.numConcesiones > 1 && `${c.numConcesiones} concesiones al mismo beneficiario en esta convocatoria, importe sumado.`,
          c.duplicados > 0 &&
            `${c.duplicados} registro${c.duplicados === 1 ? '' : 's'} con el mismo importe no se ha${c.duplicados === 1 ? '' : 'n'} sumado: posible doble registro en la BDNS, compruébalo.`,
          `${cand.señales.join('; ')}.`,
        ]
          .filter(Boolean)
          .join(' ')
          .slice(0, 2000),
        created_by: createdBy,
      })
      .select('id')
      .single();
    if (error || !ev) {
      errores.push(`Prueba ${expediente}: ${error?.message}`);
      continue;
    }
    // La copia sellada es el registro oficial tal cual lo da la API.
    try {
      await guardarCopia(admin, { alertId, evidenceId: ev.id, tipo: 'prueba', url: c.urlApi, createdBy });
      copias++;
    } catch (e) {
      errores.push(`Copia de ${expediente}: ${e instanceof Error ? e.message : e}`);
    }
  }

  if (claro && !hayPrincipal) {
    const c = claro.concesion;
    await admin
      .from('watchdog_alerts')
      .update({
        adjudicatario: c.beneficiario,
        adjudicatario_nif: c.nif,
        es_persona_fisica: esNifPersonaFisica(c.nif),
        importe_oficial_cents: c.importeCents,
        fecha_adjudicacion: c.fechaConcesion,
        organismo: c.organo.split(' › ')[0] || undefined,
        categoria: 'subvencion',
      })
      .eq('id', alertId);
  }

  return { encontrados: candidatos.length, claro: Boolean(claro), copias, errores };
}

// ── BOE (contratos y otras disposiciones) ───────────────────────────────────

interface CandidatoBoe {
  boe_id: string;
  title: string;
  url: string;
  url_xml: string;
  expediente: string | null;
  published_date: string;
  anuncio: AnuncioBoe;
  score: number;
  señales: string[];
}

function palabras(t: string): Set<string> {
  return new Set(
    t
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((p) => p.length >= 5),
  );
}

export function puntuarAnuncio(
  a: AnuncioBoe,
  titulo: string,
  p: { nif: string | null; beneficiario: string | null; importeCents: number | null; organismo: string | null; texto: string },
): { score: number; señales: string[] } {
  let score = 0;
  const señales: string[] = [];
  if (p.nif && a.adjudicatarioNif && p.nif.toUpperCase() === a.adjudicatarioNif) {
    score += 0.4;
    señales.push('mismo NIF');
  }
  if (p.importeCents && a.importeCents) {
    const dif = Math.abs(p.importeCents - a.importeCents) / a.importeCents;
    if (dif === 0) {
      score += 0.4;
      señales.push('mismo importe');
    } else if (dif <= 0.02) {
      score += 0.3;
      señales.push('importe casi igual');
    }
  }
  const delReel = palabras(`${p.texto} ${p.beneficiario ?? ''} ${p.organismo ?? ''}`);
  const comunes = [...palabras(`${titulo} ${a.adjudicatario ?? ''}`)].filter((w) => delReel.has(w));
  if (comunes.length) {
    score += Math.min(0.3, comunes.length * 0.05);
    señales.push(`palabras en común: ${comunes.slice(0, 6).join(', ')}`);
  }
  return { score: Math.round(Math.min(1, score) * 1000) / 1000, señales };
}

/**
 * Busca en el índice del BOE (0076): por expediente si el reel lo da, si no
 * por palabras clave en los títulos; lee el anuncio de los mejores y puntúa.
 */
export async function buscarEnBoe(
  admin: SupabaseClient,
  p: { nif: string | null; beneficiario: string | null; importeCents: number | null; organismo: string | null; texto: string; expediente?: string | null },
): Promise<CandidatoBoe[]> {
  type Fila = { boe_id: string; title: string; url: string; url_xml: string | null; expediente: string | null; published_date: string };
  const filas = new Map<string, Fila>();
  const sel = 'boe_id, title, url, url_xml, expediente, published_date';

  if (p.expediente) {
    const { data } = await admin.from('boe_items').select(sel).eq('expediente', p.expediente.trim()).limit(5);
    (data ?? []).forEach((f) => filas.set(f.boe_id, f as Fila));
  }
  const claves = palabrasClave(`${p.beneficiario ?? ''} ${p.texto}`, 3);
  if (claves.length >= 2) {
    let q = admin.from('boe_items').select(sel).eq('seccion_codigo', '5A');
    for (const k of claves) q = q.ilike('title', `%${k}%`);
    const { data } = await q.order('published_date', { ascending: false }).limit(8);
    (data ?? []).forEach((f) => filas.set(f.boe_id, f as Fila));
  }

  const leidos = await Promise.allSettled(
    [...filas.values()]
      .filter((f) => f.url_xml)
      .slice(0, 8)
      .map(async (f) => {
        const { anuncio } = await descargarAnuncio(f.url_xml!);
        const { score, señales } = puntuarAnuncio(anuncio, f.title, p);
        return { ...f, url_xml: f.url_xml!, anuncio, score, señales };
      }),
  );
  return leidos
    .filter((r): r is PromiseFulfilledResult<CandidatoBoe> => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((c) => c.score >= 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

/** Añade los candidatos del BOE como pruebas, con copia sellada del XML. */
async function guardarCandidatosBoe(
  admin: SupabaseClient,
  alertId: string,
  candidatos: CandidatoBoe[],
  hayPrincipal: boolean,
  createdBy: string | null,
): Promise<{ claro: CandidatoBoe | null; copias: number; errores: string[] }> {
  const errores: string[] = [];
  const [a, b] = candidatos;
  const claro = a && a.score >= SCORE_CLARO && (!b || a.score - b.score >= 0.1) ? a : null;
  let copias = 0;
  for (const c of candidatos) {
    const { data: ev, error } = await admin
      .from('watchdog_evidence')
      .insert({
        alert_id: alertId,
        source_kind: 'boe',
        expediente: [c.boe_id, c.expediente].filter(Boolean).join(' · '),
        organo: c.anuncio.organo,
        adjudicatario: c.anuncio.adjudicatario,
        nif: c.anuncio.adjudicatarioNif,
        importe_cents: c.anuncio.importeCents,
        fecha: c.anuncio.fechaAdjudicacion ?? c.published_date,
        url: c.url,
        raw: { origen: 'boe', boe_id: c.boe_id, titulo: c.title, anuncio: c.anuncio },
        match_score: c.score,
        matched_by: 'auto',
        selected: c === claro && !hayPrincipal,
        notes: `Encontrado en el BOE (${c.published_date}). ${c.señales.join('; ')}.`.slice(0, 2000),
        created_by: createdBy,
      })
      .select('id')
      .single();
    if (error || !ev) {
      errores.push(`Prueba ${c.boe_id}: ${error?.message}`);
      continue;
    }
    try {
      await guardarCopia(admin, { alertId, evidenceId: ev.id, tipo: 'prueba', url: c.url_xml, createdBy });
      copias++;
    } catch (e) {
      errores.push(`Copia de ${c.boe_id}: ${e instanceof Error ? e.message : e}`);
    }
  }
  if (claro && !hayPrincipal) {
    await admin
      .from('watchdog_alerts')
      .update({
        adjudicatario: claro.anuncio.adjudicatario ?? undefined,
        adjudicatario_nif: claro.anuncio.adjudicatarioNif ?? undefined,
        es_persona_fisica: esNifPersonaFisica(claro.anuncio.adjudicatarioNif),
        importe_oficial_cents: claro.anuncio.importeCents ?? undefined,
        fecha_adjudicacion: claro.anuncio.fechaAdjudicacion ?? undefined,
        organismo: claro.anuncio.organo ?? undefined,
      })
      .eq('id', alertId);
  }
  return { claro, copias, errores };
}

/**
 * Copia de respaldo del origen. Artículos y webs se copian aquí; los reels
 * de Instagram/TikTok no (sin sesión solo dan la pantalla de login): su vídeo
 * lo sube el bot de n8n.
 */
export async function copiarOrigen(
  admin: SupabaseClient,
  alertId: string,
  url: string | null,
  createdBy: string | null = null,
): Promise<'copiado' | 'red_social' | 'sin_url' | string> {
  if (!url) return 'sin_url';
  if (esRedSocial(url)) return 'red_social';
  try {
    await guardarCopia(admin, { alertId, tipo: 'origen', url, createdBy });
    return 'copiado';
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}
