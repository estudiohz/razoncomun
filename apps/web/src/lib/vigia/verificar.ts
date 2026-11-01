import type { SupabaseClient } from '@supabase/supabase-js';
import { buscarEnBdns, concesionesDeConvocatoria, puntuarConcesion, type CandidatoBdns, type PistaBdns } from './bdns';
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
  pista: PistaBdns & { codigoBdns?: string | null },
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
  if (!candidatos.length) return { encontrados: 0, claro: false, copias: 0, errores };

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
        notes: `Encontrado en la BDNS.${c.numConcesiones > 1 ? ` ${c.numConcesiones} concesiones al mismo beneficiario en esta convocatoria, importe sumado.` : ''} ${cand.señales.join('; ')}.`.slice(0, 2000),
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
