/**
 * Solicitudes de acceso a la información pública (Ley 19/2013) hechas desde
 * un caso de auditoría. El Portal de Transparencia no tiene API y exige
 * Cl@ve, así que aquí se redacta la solicitud, se presenta a mano y se sigue
 * el plazo:
 *  - art. 20.1: un mes para resolver desde la recepción, ampliable un mes más;
 *  - art. 20.4: sin respuesta en plazo, se entiende desestimada (silencio);
 *  - art. 24.2: un mes para reclamar ante el Consejo de Transparencia desde el
 *    día siguiente al silencio o a la notificación.
 */

export const PORTAL_TRANSPARENCIA = 'https://transparencia.gob.es/transparencia/es/Solicitudes.html';

export const ESTADOS_SOLICITUD = [
  'borrador',
  'presentada',
  'ampliada',
  'respondida',
  'denegada',
  'silencio',
  'reclamada',
  'cerrada',
] as const;
export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[number];

export const ETIQUETA_SOLICITUD: Record<EstadoSolicitud, string> = {
  borrador: 'Borrador',
  presentada: 'Presentada',
  ampliada: 'Plazo ampliado',
  respondida: 'Respondida',
  denegada: 'Denegada',
  silencio: 'Sin respuesta (silencio)',
  reclamada: 'Reclamada al CTBG',
  cerrada: 'Cerrada',
};

/** Suma meses a una fecha AAAA-MM-DD (si el día no existe, último del mes). */
export function sumarMeses(fecha: string, meses: number): string {
  const [a, m, d] = fecha.split('-').map(Number);
  const destino = new Date(Date.UTC(a, m - 1 + meses, 1));
  const ultimo = new Date(Date.UTC(destino.getUTCFullYear(), destino.getUTCMonth() + 1, 0)).getUTCDate();
  destino.setUTCDate(Math.min(d, ultimo));
  return destino.toISOString().slice(0, 10);
}

export interface SolicitudParaPlazos {
  estado: EstadoSolicitud;
  presentada_at: string | null;
  ampliada_at: string | null;
  respuesta_at: string | null;
}

/** Fecha límite para que la Administración resuelva (null si no se ha presentado). */
export function plazoResolver(s: SolicitudParaPlazos): string | null {
  if (!s.presentada_at) return null;
  return sumarMeses(s.presentada_at, s.ampliada_at ? 2 : 1);
}

/**
 * Estado real a fecha `hoy`: una solicitud presentada o ampliada cuyo plazo
 * ha pasado sin respuesta está en silencio administrativo, se haya anotado o no.
 */
export function estadoEfectivo(s: SolicitudParaPlazos, hoy: string): EstadoSolicitud {
  const plazo = plazoResolver(s);
  if ((s.estado === 'presentada' || s.estado === 'ampliada') && plazo && hoy > plazo && !s.respuesta_at) {
    return 'silencio';
  }
  return s.estado;
}

/** Último día para reclamar ante el Consejo de Transparencia (art. 24.2). */
export function plazoReclamar(s: SolicitudParaPlazos, hoy: string): string | null {
  const estado = estadoEfectivo(s, hoy);
  if (estado === 'silencio') {
    const plazo = plazoResolver(s);
    return plazo ? sumarMeses(plazo, 1) : null;
  }
  if (estado === 'denegada' && s.respuesta_at) return sumarMeses(s.respuesta_at, 1);
  return null;
}

/** Días que faltan (negativo si ya pasó). */
export function diasHasta(fecha: string, hoy: string): number {
  return Math.round((Date.parse(fecha) - Date.parse(hoy)) / 86_400_000);
}

export interface DatosParaSolicitud {
  organismo: string | null;
  adjudicatario: string | null;
  adjudicatario_nif: string | null;
  importe_oficial_cents: number | null;
  fecha_adjudicacion: string | null;
  expediente: string | null; // BDNS o expediente de contratación de la prueba principal
  urlOficial: string | null;
}

const euros = (c: number) => (c / 100).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Borrador de la solicitud. Pide documentos concretos y verificables, sin
 * valoraciones: es lo que tiene más probabilidades de respuesta útil.
 */
export function redactarSolicitud(d: DatosParaSolicitud): { asunto: string; texto: string } {
  const ref = d.expediente ? `expediente ${d.expediente}` : 'la concesión o contrato descrito';
  const asunto = `Acceso a la documentación de ${ref}${d.adjudicatario ? ` (${d.adjudicatario})` : ''}`.slice(0, 250);

  const identificacion = [
    d.organismo && `Órgano: ${d.organismo}.`,
    d.adjudicatario && `Beneficiario o adjudicatario: ${d.adjudicatario}${d.adjudicatario_nif ? ` (NIF ${d.adjudicatario_nif})` : ''}.`,
    d.importe_oficial_cents != null && `Importe: ${euros(d.importe_oficial_cents)} €.`,
    d.fecha_adjudicacion && `Fecha de concesión o adjudicación: ${d.fecha_adjudicacion}.`,
    d.expediente && `Referencia: ${d.expediente}.`,
    d.urlOficial && `Publicación oficial: ${d.urlOficial}`,
  ]
    .filter(Boolean)
    .join('\n');

  const texto = `Al amparo de la Ley 19/2013, de 9 de diciembre, de transparencia, acceso a la información pública y buen gobierno, solicito el acceso a la siguiente información relativa a ${ref}:

${identificacion}

1. La resolución o acuerdo de concesión o adjudicación completo.
2. La memoria o informe que justifica el procedimiento seguido y, si fue una concesión directa o sin concurrencia, las razones que lo motivaron.
3. El convenio, contrato o instrumento firmado y sus modificaciones.
4. Los informes de seguimiento, la justificación del gasto presentada por el beneficiario y, en su caso, los informes de comprobación o reintegro.

Solicito que la información se facilite en formato electrónico. Si parte de ella estuviera sujeta a algún límite del artículo 14 o 15, solicito el acceso parcial previsto en el artículo 16.`;

  return { asunto, texto };
}
