import { CATEGORIAS, NIVELES, textoAHtml } from './casos';

/**
 * Extracción automática del reel (Gemini, vía el bot de n8n) → columnas del
 * caso. Lo que llega es salida de un modelo sobre texto de terceros: se trata
 * como DATO no fiable. Todo se valida y recorta aquí; lo que no encaja se
 * descarta (queda en `ai_extraction` en bruto para que el auditor lo vea).
 */

export interface CampoExtraido<T> {
  value: T | null;
  confidence: number;
}

/** Por debajo de esto, la ficha marca el dato como «revísalo». */
export const CONFIANZA_MINIMA = 0.7;

/** Campos que la ficha muestra con su confianza. */
export const CAMPOS_CON_CONFIANZA = [
  'organismo',
  'organismo_nivel',
  'adjudicatario',
  'nif',
  'importe_cents',
  'fecha',
  'expediente',
  'categoria',
] as const;
export type CampoConConfianza = (typeof CAMPOS_CON_CONFIANZA)[number];

function campo(raw: unknown): CampoExtraido<unknown> {
  if (raw && typeof raw === 'object' && 'value' in raw) {
    const c = Number((raw as { confidence?: unknown }).confidence);
    return { value: (raw as { value: unknown }).value ?? null, confidence: Number.isFinite(c) ? Math.min(1, Math.max(0, c)) : 0 };
  }
  return { value: null, confidence: 0 };
}

function cadena(v: unknown, max: number): string | null {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const s = String(v).replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, max) : null;
}

function enLista<T extends string>(lista: readonly T[], v: unknown): T | null {
  return typeof v === 'string' && (lista as readonly string[]).includes(v) ? (v as T) : null;
}

/** Confianza de cada campo, para guardarla junto al caso y pintarla en la ficha. */
export function confianzas(extraccion: unknown): Partial<Record<CampoConConfianza, number>> {
  const e = (extraccion ?? {}) as Record<string, unknown>;
  const out: Partial<Record<CampoConConfianza, number>> = {};
  for (const k of CAMPOS_CON_CONFIANZA) {
    const c = campo(e[k]);
    if (c.value != null && c.value !== '') out[k] = c.confidence;
  }
  return out;
}

/** Columnas de `watchdog_alerts` que se rellenan con la extracción. */
export function columnasDesdeExtraccion(extraccion: unknown) {
  const e = (extraccion ?? {}) as Record<string, unknown>;
  const v = (k: string) => campo(e[k]).value;

  const importe = Number(v('importe_cents'));
  const fecha = cadena(v('fecha'), 10);
  const organismo = cadena(v('organismo'), 300);
  const adjudicatario = cadena(v('adjudicatario'), 300);
  const resumen = cadena(e.resumen_hechos, 1500);
  const afirmaciones = Array.isArray(e.afirmaciones_a_verificar)
    ? e.afirmaciones_a_verificar.map((a) => cadena(a, 300)).filter(Boolean).slice(0, 10)
    : [];

  const titulo =
    cadena(e.titulo, 120) ??
    [organismo, adjudicatario].filter(Boolean).join(' → ').slice(0, 120) ??
    null;

  // Borrador para el auditor: lo que AFIRMA el reel, en neutro. No son hechos
  // verificados hasta que el auditor los contraste con la prueba oficial.
  const borradorHechos = [
    resumen,
    afirmaciones.length ? `Afirmaciones a comprobar:\n${afirmaciones.map((a) => `• ${a}`).join('\n')}` : null,
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    title: titulo || null,
    organismo,
    organismo_nivel: enLista(NIVELES, v('organismo_nivel')),
    adjudicatario,
    adjudicatario_nif: cadena(v('nif'), 20)?.toUpperCase().replace(/[^0-9A-Z]/g, '') || null,
    es_persona_fisica: e.adjudicatario_es_persona_fisica === true,
    categoria: enLista(CATEGORIAS, v('categoria')),
    importe_denunciado_cents: Number.isSafeInteger(importe) && importe > 0 ? importe : null,
    fecha_adjudicacion: fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) && !Number.isNaN(Date.parse(fecha)) ? fecha : null,
    hechos_html: textoAHtml(borradorHechos),
  };
}

/** Términos que el modelo ha marcado como lenguaje de riesgo (M5). */
export function lenguajeDeRiesgo(extraccion: unknown): string[] {
  const l = (extraccion as { lenguaje_de_riesgo_detectado?: unknown } | null)?.lenguaje_de_riesgo_detectado;
  return Array.isArray(l) ? l.map((t) => cadena(t, 80)).filter((t): t is string => Boolean(t)).slice(0, 20) : [];
}
