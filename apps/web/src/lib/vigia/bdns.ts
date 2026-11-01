/**
 * BDNS — Base de Datos Nacional de Subvenciones (infosubvenciones.es). API
 * pública sin clave, la misma que usa su web. Es la FUENTE OFICIAL de las
 * subvenciones: lo que sale de aquí es la prueba, no una pista.
 *
 * Endpoints comprobados el 01-11-2026:
 *  - concesiones/busqueda?vpd=GE&nifCif=…            → concesiones de un beneficiario
 *  - concesiones/busqueda?vpd=GE&numeroConvocatoria=… → concesiones de una convocatoria
 *  - convocatorias/busqueda?vpd=GE&descripcion=…     → convocatorias por texto (todas las palabras)
 *  - convocatorias?vpd=GE&numConv=…                  → ficha de la convocatoria
 * (los filtros de fecha e importe de concesiones/busqueda se ignoran: se
 * filtra aquí).
 */

export const BDNS_API = 'https://www.infosubvenciones.es/bdnstrans/api';
const BDNS_WEB = 'https://www.pap.hacienda.gob.es/bdnstrans/GE/es';

export interface ConcesionBdns {
  codConcesion: string;
  numeroConvocatoria: string;
  convocatoria: string;
  beneficiario: string; // nombre sin el NIF
  nif: string | null;
  importeCents: number | null;
  fechaConcesion: string | null;
  organo: string; // nivel2 › nivel3
  instrumento: string | null;
  urlBases: string | null; // bases reguladoras en el BOE
  urlConvocatoria: string;
  urlConcesiones: string;
  urlApi: string; // registro oficial en bruto (lo que se sella)
  raw: Record<string, unknown>;
}

const NIF = /^([A-HJ-NP-SUVW]\d{7}[0-9A-J]|\d{8}[A-Z]|[XYZ]\d{7}[A-Z])\s+(.+)$/i;

function cadena(v: unknown, max = 1000): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
}

export function aConcesion(o: Record<string, unknown>): ConcesionBdns | null {
  const cod = cadena(o.codConcesion, 40);
  const conv = cadena(String(o.numeroConvocatoria ?? ''), 20);
  const benef = cadena(o.beneficiario, 300);
  if (!cod || !conv || !benef) return null;
  const m = benef.match(NIF);
  const importe = Number(o.importe);
  const fecha = cadena(o.fechaConcesion, 10);
  const url = cadena(o.urlBR, 500);
  return {
    codConcesion: cod,
    numeroConvocatoria: conv,
    convocatoria: cadena(o.convocatoria, 1000) ?? '',
    beneficiario: (m ? m[2] : benef).replace(/\s+/g, ' ').trim(),
    nif: m ? m[1].toUpperCase() : null,
    importeCents: Number.isFinite(importe) && importe > 0 ? Math.round(importe * 100) : null,
    fechaConcesion: fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : null,
    organo: [cadena(o.nivel2, 200), cadena(o.nivel3, 200)].filter(Boolean).join(' › '),
    instrumento: cadena(o.instrumento, 200),
    urlBases: url && /^https:\/\//i.test(url) ? url : null,
    urlConvocatoria: `${BDNS_WEB}/convocatorias/${encodeURIComponent(conv)}`,
    urlConcesiones: `${BDNS_WEB}/concesiones/consulta?numeroConvocatoria=${encodeURIComponent(conv)}`,
    urlApi: `${BDNS_API}/concesiones/busqueda?vpd=GE&numeroConvocatoria=${encodeURIComponent(conv)}&page=0&pageSize=50`,
    raw: o,
  };
}

function palabras(t: string): Set<string> {
  return new Set(
    t
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((p) => p.length >= 5),
  );
}

export interface PistaBdns {
  nif: string | null;
  beneficiario: string | null;
  importeCents: number | null;
  organismo: string | null;
  texto: string; // transcripción, mensaje, título…
}

export interface CandidatoBdns {
  concesion: ConcesionBdns;
  score: number;
  señales: string[];
}

export function puntuarConcesion(c: ConcesionBdns, p: PistaBdns): CandidatoBdns {
  let score = 0;
  const señales: string[] = [];
  if (p.nif && c.nif && p.nif.toUpperCase() === c.nif) {
    score += 0.4;
    señales.push('mismo NIF');
  }
  if (p.importeCents && c.importeCents) {
    const dif = Math.abs(p.importeCents - c.importeCents) / c.importeCents;
    if (dif === 0) {
      score += 0.4;
      señales.push('mismo importe');
    } else if (dif <= 0.02) {
      score += 0.3;
      señales.push('importe casi igual');
    }
  }
  const delReel = palabras(`${p.texto} ${p.beneficiario ?? ''} ${p.organismo ?? ''}`);
  const comunes = [...palabras(`${c.beneficiario} ${c.convocatoria}`)].filter((w) => delReel.has(w));
  if (comunes.length) {
    score += Math.min(0.3, comunes.length * 0.06);
    señales.push(`palabras en común: ${comunes.slice(0, 6).join(', ')}`);
  }
  const organo = palabras(c.organo);
  if ([...palabras(p.organismo ?? '')].some((w) => organo.has(w) && w !== 'ministerio')) {
    score += 0.1;
    señales.push('mismo órgano');
  }
  return { concesion: c, score: Math.round(Math.min(1, score) * 1000) / 1000, señales };
}

/** Frases para buscar convocatorias por texto, de más a menos concretas. */
export function consultasDeTexto(p: PistaBdns): string[] {
  const limpiar = (t: string) =>
    t
      .replace(/\b(S\.?L\.?U?|S\.?A\.?|S\.?COOP|ASOCIACI[OÓ]N|FUNDACI[OÓ]N)\b\.?/gi, ' ')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const out: string[] = [];
  if (p.beneficiario) {
    const b = limpiar(p.beneficiario);
    if (b.split(' ').length >= 2) out.push(b.split(' ').slice(0, 6).join(' '));
  }
  return [...new Set(out)].filter((q) => q.length >= 6).slice(0, 3);
}

async function pedirJson(url: string, timeoutMs: number): Promise<unknown> {
  const r = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { accept: 'application/json', 'user-agent': 'RazonComun-Auditoria/1.0 (+https://razoncomun.com)' },
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`BDNS ${r.status}`);
  return r.json();
}

function contenido(d: unknown): Record<string, unknown>[] {
  const c = (d as { content?: unknown })?.content;
  return Array.isArray(c) ? (c as Record<string, unknown>[]) : [];
}

/** Concesiones de una convocatoria (la usa también la confirmación de El Rastro). */
export async function concesionesDeConvocatoria(numero: string, timeoutMs = 10000): Promise<ConcesionBdns[]> {
  const d = await pedirJson(
    `${BDNS_API}/concesiones/busqueda?vpd=GE&page=0&pageSize=50&numeroConvocatoria=${encodeURIComponent(numero)}`,
    timeoutMs,
  );
  return contenido(d).map(aConcesion).filter((c): c is ConcesionBdns => Boolean(c));
}

/**
 * Busca en la BDNS las concesiones que encajan con el caso. Con NIF va
 * directo; sin él, busca convocatorias por el nombre del beneficiario y mira
 * sus concesiones. Devuelve los mejores, ordenados.
 */
export async function buscarEnBdns(p: PistaBdns, timeoutMs = 10000): Promise<CandidatoBdns[]> {
  const encontradas = new Map<string, ConcesionBdns>();
  const meter = (lista: ConcesionBdns[]) => lista.forEach((c) => encontradas.set(c.codConcesion, c));

  if (p.nif) {
    const d = await pedirJson(
      `${BDNS_API}/concesiones/busqueda?vpd=GE&page=0&pageSize=50&nifCif=${encodeURIComponent(p.nif)}`,
      timeoutMs,
    );
    meter(contenido(d).map(aConcesion).filter((c): c is ConcesionBdns => Boolean(c)));
  }

  for (const q of consultasDeTexto(p)) {
    const d = await pedirJson(
      `${BDNS_API}/convocatorias/busqueda?vpd=GE&page=0&pageSize=5&descripcion=${encodeURIComponent(q)}`,
      timeoutMs,
    ).catch(() => null);
    const convocatorias = contenido(d)
      .map((x) => cadena(String(x.numeroConvocatoria ?? ''), 20))
      .filter((n): n is string => Boolean(n))
      .slice(0, 5);
    const resultados = await Promise.allSettled(convocatorias.map((n) => concesionesDeConvocatoria(n, timeoutMs)));
    for (const r of resultados) if (r.status === 'fulfilled') meter(r.value);
  }

  return [...encontradas.values()]
    .map((c) => puntuarConcesion(c, p))
    .filter((c) => c.score >= 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}
