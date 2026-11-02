/**
 * Reglas del caso de auditoría (docs/auditoria-tiempo-real/04-arquitectura.md
 * §4.5). Funciones puras: las usan las server actions antes de escribir y la
 * UI para explicar qué falta. La última palabra la tienen los triggers de la
 * 0069 — esto es para que el auditor vea el motivo antes de chocar con ellos.
 */

export const ESTADOS_CASO = ['flagged', 'analyzed', 'pending_reply', 'verified', 'published', 'dismissed'] as const;
export type EstadoCaso = (typeof ESTADOS_CASO)[number];

export const ETIQUETA_ESTADO: Record<EstadoCaso, string> = {
  flagged: 'Abierto',
  analyzed: 'En análisis',
  pending_reply: 'Réplica pedida',
  verified: 'Verificado',
  published: 'Publicado',
  dismissed: 'Descartado',
};

export const NIVELES = ['estatal', 'autonomico', 'local', 'otro'] as const;
export const CATEGORIAS = ['consultoria', 'eventos', 'publicidad', 'obras', 'suministros', 'subvencion', 'otro'] as const;
export const VERIFICACIONES = ['coincide', 'parcial', 'no_encontrado', 'desmentido'] as const;
export const FUENTES_PRUEBA = ['placsp', 'boe', 'bdns', 'borme', 'autonomica', 'otro'] as const;

/**
 * Checklist M5 (lenguaje prudente, doc 03): el auditor lo marca entero antes
 * de aprobar. Las claves se guardan en el `audit_log` de la aprobación.
 */
export const CHECKLIST_M5 = [
  { id: 'sin_delitos', texto: 'No se imputa ningún delito ni se insinúa (malversación, fraude, robo…).' },
  { id: 'sin_calificativos', texto: 'No hay calificativos vejatorios ni adjetivos sobre personas o empresas.' },
  { id: 'hechos_separados', texto: 'Los hechos verificados están separados de la valoración de Razón Común.' },
  { id: 'personas_minimas', texto: 'Solo aparecen personas físicas si es imprescindible, con los datos mínimos.' },
  { id: 'fuente_oficial', texto: 'Cada cifra de los hechos sale de la prueba oficial enlazada, no del reel.' },
] as const;

export interface CasoParaReglas {
  status: EstadoCaso;
  adjudicatario: string | null;
  es_persona_fisica: boolean;
  replica_solicitada_at: string | null;
  hechos_html: string | null;
  verificacion: string | null;
  reel_url: string | null;
  reel_autor: string | null;
}

/**
 * D-A13: la réplica previa es OBLIGATORIA si el caso nombra a una empresa
 * adjudicataria o a una persona física; si solo nombra al órgano público, es
 * recomendable pero no bloquea.
 */
export function replicaObligatoria(caso: Pick<CasoParaReglas, 'adjudicatario' | 'es_persona_fisica'>): boolean {
  return caso.es_persona_fisica || Boolean(caso.adjudicatario?.trim());
}

/**
 * Lo que impide aprobar (pasar a `verified`). Lista vacía = se puede.
 * `pruebaPrincipal`: si hay una prueba marcada como principal.
 */
export function bloqueosAprobar(
  caso: CasoParaReglas,
  pruebaPrincipal: boolean,
  checklist: readonly string[],
): string[] {
  const motivos: string[] = [];
  if (!['flagged', 'analyzed', 'pending_reply'].includes(caso.status)) {
    motivos.push(`Un caso «${ETIQUETA_ESTADO[caso.status]}» no se puede aprobar.`);
  }
  if (!caso.hechos_html?.trim()) motivos.push('Falta el bloque de hechos verificados.');
  if (!caso.verificacion) motivos.push('Falta indicar si el reel coincide con la fuente oficial.');
  if (!pruebaPrincipal) motivos.push('Falta marcar una prueba oficial como principal.');
  if (!caso.reel_url?.trim() || !caso.reel_autor?.trim()) {
    motivos.push('Falta citar el origen: enlace y autor o medio (0073).');
  }
  // La réplica ya no bloquea la aprobación: si no se pudo pedir, se confirma al publicar.
  const faltan = CHECKLIST_M5.filter((c) => !checklist.includes(c.id));
  if (faltan.length) motivos.push(`Falta marcar ${faltan.length} punto${faltan.length === 1 ? '' : 's'} del checklist de lenguaje.`);
  return motivos;
}

/** Convierte euros escritos a mano ("12.345,67 €", "12345.67") en céntimos. null si no se entiende. */
export function eurosACentimos(texto: string | null | undefined): number | null {
  if (!texto) return null;
  let t = texto.replace(/[€\s]/g, '');
  if (!t) return null;
  // Formato español: puntos de miles y coma decimal.
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

export function centimosAEuros(c: number | null | undefined): string {
  if (c == null) return '';
  return (c / 100).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/**
 * Texto plano del formulario → HTML de párrafos, con todo escapado. Los campos
 * `*_html` del caso nunca reciben HTML del auditor: así no hay nada que sanear
 * al pintarlo.
 */
export function textoAHtml(texto: string | null | undefined): string | null {
  const limpio = texto?.replace(/\r\n/g, '\n').trim();
  if (!limpio) return null;
  return limpio
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/[&<>"']/g, (c) => ESCAPES[c]).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** Inversa de `textoAHtml`, para volver a rellenar el formulario. */
export function htmlATexto(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<\/p>\s*<p>/g, '\n\n')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<\/?p>/g, '')
    .replace(/&(amp|lt|gt|quot|#39);/g, (_, e: string) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[e]!);
}

/**
 * Enlace del reel listo para citar en público (0073): sin parámetros de
 * seguimiento en Instagram y TikTok (`?utm_source=…&srtk=…`). En YouTube el
 * `?v=` es parte del enlace y se deja tal cual.
 */
export function limpiarUrlReel(url: string | null | undefined): string | null {
  const u = url?.trim();
  if (!u || !/^https?:\/\//i.test(u)) return null;
  return /^https?:\/\/(www\.)?(instagram\.com|tiktok\.com)\//i.test(u) ? u.replace(/[?#].*$/, '') : u;
}

/** '@usuario' a partir de lo que escriba el auditor ("elrastrodeldinero", "@x", la URL del perfil…). */
export function normalizarAutor(texto: string | null | undefined): string | null {
  const t = texto?.trim();
  if (!t) return null;
  const perfil = t.match(/instagram\.com\/([A-Za-z0-9._]+)/i)?.[1];
  const usuario = (perfil ?? t).replace(/^@/, '');
  return /^[A-Za-z0-9._]{1,60}$/.test(usuario) ? `@${usuario}` : t.slice(0, 120);
}

/** Perfil de Instagram de un autor '@usuario' (null si no es un @usuario). */
export function perfilDeAutor(autor: string | null): string | null {
  const m = autor?.match(/^@([A-Za-z0-9._]{1,60})$/);
  return m ? `https://www.instagram.com/${m[1]}/` : null;
}

/**
 * Autor por defecto de un origen que no es una red social (artículo, web):
 * el dominio, sin www. En Instagram/TikTok/YouTube el enlace no dice el autor
 * y lo completa el auditor (o El Rastro, si el reel lo cita).
 */
export function autorPorDefecto(url: string | null): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return /(^|\.)(instagram\.com|tiktok\.com|youtube\.com|youtu\.be)$/i.test(host) ? null : host;
  } catch {
    return null;
  }
}
