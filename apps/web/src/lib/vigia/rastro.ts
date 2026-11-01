/**
 * El Rastro del Dinero (elrastrodeldinero.com): la web del creador de los
 * reels documenta cada caso con el expediente oficial (código BDNS, NIF del
 * beneficiario, importe, fecha y enlace a la fuente). Tenemos su permiso
 * (D-A03, acuerdo concedido el 01-11-2026).
 *
 * Si un reel cita la web, se buscan sus expedientes y se empareja el del
 * reel. La web es Nuxt: los datos van serializados en `#__NUXT_DATA__`
 * (formato devalue: un array plano donde los objetos apuntan a índices).
 * Todo lo que se lee de aquí es DATO de un tercero: se valida y recorta antes
 * de guardarlo, y el auditor confirma contra la fuente oficial enlazada.
 */

export const RASTRO_BASE = 'https://elrastrodeldinero.com';

export interface ExpedienteRastro {
  id: string;
  titulo: string;
  tituloCorto: string;
  beneficiario: string;
  nif: string | null;
  importeCents: number | null;
  fechaConcesion: string | null;
  bdns: string | null;
  ministerio: string;
  ministerioSlug: string;
  tipoConvocatoria: string | null;
  finalidad: string | null;
  fuentes: string[];
  raw: Record<string, unknown>;
}

/** ¿El reel menciona la web? (texto del mensaje, transcripción…). */
export function citaElRastro(...textos: (string | null | undefined)[]): boolean {
  return textos.some((t) => t && /el\s*rastro\s*del\s*dinero|elrastrodeldinero/i.test(t));
}

/** Decodifica el array de devalue que Nuxt mete en `__NUXT_DATA__`. */
function decodificarDevalue(datos: unknown[]): unknown {
  const ENVOLTORIOS = new Set(['ShallowReactive', 'Reactive', 'Ref', 'ShallowRef']);
  const resolver = (i: unknown, prof: number): unknown => {
    if (prof > 60 || typeof i !== 'number' || i < 0 || i >= datos.length) return null;
    const v = datos[i];
    if (Array.isArray(v)) {
      if (typeof v[0] === 'string' && ENVOLTORIOS.has(v[0])) return resolver(v[1], prof + 1);
      if (typeof v[0] === 'string') return null; // Date, Set, Map…: no los necesitamos
      return v.map((x) => resolver(x, prof + 1));
    }
    if (v && typeof v === 'object') {
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolver(x, prof + 1)]));
    }
    return v;
  };
  return resolver(0, 0);
}

const NIF = /^([A-HJ-NP-SUVW]\d{7}[0-9A-J]|\d{8}[A-Z]|[XYZ]\d{7}[A-Z])\s+(.+)$/i;

function cadena(v: unknown, max = 500): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
}

function aExpediente(o: Record<string, unknown>): ExpedienteRastro | null {
  const id = cadena(o.id, 64);
  const beneficiarioRaw = cadena(o.beneficiario);
  if (!id || !beneficiarioRaw) return null;
  const m = beneficiarioRaw.match(NIF);
  const importe = Number(o.importe);
  const fecha = cadena(o.fecha_concesion, 10);
  return {
    id,
    titulo: cadena(o.titulo, 1000) ?? '',
    tituloCorto: cadena(o.title_abbr, 200) ?? '',
    beneficiario: m ? m[2].trim() : beneficiarioRaw,
    nif: m ? m[1].toUpperCase() : null,
    importeCents: Number.isFinite(importe) && importe > 0 ? Math.round(importe * 100) : null,
    fechaConcesion: fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : null,
    bdns: cadena(o.bdns, 40),
    ministerio: cadena(o.ministerio_nombre, 200) ?? '',
    ministerioSlug: cadena(o.ministerio_slug, 60) ?? '',
    tipoConvocatoria: cadena(o.tipo_convocatoria, 200),
    finalidad: cadena(o.finalidad, 300),
    fuentes: (cadena(o.fuente_url, 2000) ?? '')
      .split(/[\s,]+/)
      .filter((u) => /^https:\/\/[^\s]+$/i.test(u))
      .slice(0, 5),
    raw: o,
  };
}

/** Expedientes que hay en el HTML de una página de la web. */
export function expedientesDeHtml(html: string): ExpedienteRastro[] {
  const m = html.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return [];
  let datos: unknown;
  try {
    datos = JSON.parse(m[1]);
  } catch {
    return [];
  }
  if (!Array.isArray(datos)) return [];

  const encontrados = new Map<string, ExpedienteRastro>();
  const recorrer = (o: unknown, prof: number) => {
    if (prof > 40 || !o || typeof o !== 'object') return;
    if (Array.isArray(o)) return o.forEach((x) => recorrer(x, prof + 1));
    const r = o as Record<string, unknown>;
    if ('bdns' in r && 'beneficiario' in r) {
      const e = aExpediente(r);
      if (e) encontrados.set(e.id, e);
    }
    Object.values(r).forEach((x) => recorrer(x, prof + 1));
  };
  recorrer(decodificarDevalue(datos), 0);
  return [...encontrados.values()];
}

/** Palabras con contenido, sin tildes, para comparar textos. */
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

export interface PistaReel {
  importeCents: number | null;
  organismo: string | null;
  texto: string; // transcripción + mensaje + título y resumen de la IA
}

export interface Candidato {
  expediente: ExpedienteRastro;
  score: number;
  señales: string[];
}

/**
 * Puntuación 0–1 de lo bien que un expediente encaja con el reel. El importe
 * pesa más porque es lo que los reels dicen siempre y lo que menos falla.
 */
export function puntuar(e: ExpedienteRastro, pista: PistaReel): Candidato {
  let score = 0;
  const señales: string[] = [];

  if (pista.importeCents && e.importeCents) {
    const dif = Math.abs(pista.importeCents - e.importeCents) / e.importeCents;
    if (dif === 0) {
      score += 0.5;
      señales.push('mismo importe');
    } else if (dif <= 0.02) {
      score += 0.4;
      señales.push('importe casi igual');
    }
  }

  const delReel = palabras(`${pista.texto} ${pista.organismo ?? ''}`);
  if (e.ministerioSlug && delReel.has(e.ministerioSlug.normalize('NFD').replace(/[̀-ͯ]/g, ''))) {
    score += 0.15;
    señales.push(`ministerio de ${e.ministerioSlug}`);
  }

  const delExpediente = palabras(`${e.tituloCorto} ${e.titulo} ${e.beneficiario}`);
  const comunes = [...delExpediente].filter((p) => delReel.has(p));
  if (comunes.length) {
    score += Math.min(0.35, comunes.length * 0.07);
    señales.push(`palabras en común: ${comunes.slice(0, 6).join(', ')}`);
  }

  return { expediente: e, score: Math.round(Math.min(1, score) * 1000) / 1000, señales };
}

/** Umbral para dar un expediente por bueno sin preguntar al auditor. */
export const SCORE_SEGURO = 0.6;

/**
 * Ordena los candidatos y dice si hay uno claro: por encima del umbral y con
 * ventaja suficiente sobre el segundo (si hay dos casi iguales, que decida el
 * auditor).
 */
export function elegir(candidatos: Candidato[]): { mejores: Candidato[]; claro: Candidato | null } {
  const mejores = candidatos
    .filter((c) => c.score >= 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  const [primero, segundo] = mejores;
  const claro = primero && primero.score >= SCORE_SEGURO && (!segundo || primero.score - segundo.score >= 0.1) ? primero : null;
  return { mejores, claro };
}

/** Un DNI o NIE (persona física) empieza por número o por X/Y/Z. */
export function esNifPersonaFisica(nif: string | null): boolean {
  return Boolean(nif && /^(\d|[XYZ])/i.test(nif));
}

/**
 * Descarga todas las páginas de ministerio del sitemap y reúne sus
 * expedientes. Tiempo acotado: si la web no responde, se sigue sin ella.
 */
export async function descargarExpedientes(timeoutMs = 8000): Promise<ExpedienteRastro[]> {
  const pedir = async (url: string) => {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'user-agent': 'RazonComun-Auditoria/1.0 (+https://razoncomun.com)' },
      cache: 'no-store',
    });
    if (!r.ok) throw new Error(`${url} → ${r.status}`);
    return r.text();
  };

  const sitemap = await pedir(`${RASTRO_BASE}/sitemap.xml`);
  const paginas = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1].trim())
    .filter((u) => u.startsWith(`${RASTRO_BASE}/ministerio/`))
    .slice(0, 30);

  const resultados = await Promise.allSettled(paginas.map((u) => pedir(u)));
  const todos = new Map<string, ExpedienteRastro>();
  for (const r of resultados) {
    if (r.status === 'fulfilled') for (const e of expedientesDeHtml(r.value)) todos.set(e.id, e);
  }
  return [...todos.values()];
}
