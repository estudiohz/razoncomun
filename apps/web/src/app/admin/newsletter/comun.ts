/** Piezas compartidas por el listado y el detalle de la newsletter. */

export interface Stats {
  campaign_id: string;
  enviados: number;
  pendientes: number;
  fallidos: number;
  omitidos: number;
  entregados: number;
  abiertos: number;
  clics: number;
  rebotes: number;
  bajas: number;
  spam: number;
}

export const TIPO: Record<string, string> = {
  encuesta_inicio: 'Encuesta del mes',
  encuesta_recordatorio: 'Recordatorio',
  manual: 'Manual',
};

export const ESTADO: Record<string, { texto: string; clase: string }> = {
  enviando: { texto: 'Enviando', clase: 'bg-naranja/10 text-naranja' },
  enviada: { texto: 'Enviada', clase: 'bg-teal-texto/10 text-teal-texto' },
  cancelada: { texto: 'Cancelada', clase: 'bg-gris/15 text-gris' },
};

export const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : '—');
