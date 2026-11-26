/**
 * Alternativa de Razón Común por tema, sacada LITERALMENTE de los 30 puntos
 * del manifiesto (CLAUDE.md del proyecto). No se inventan cifras: lo que no
 * está en el manifiesto no se promete aquí.
 */
export interface AlternativaRc {
  puntos: { n: number; titulo: string; texto: string }[];
}

export const ALTERNATIVAS_RC: Record<string, AlternativaRc> = {
  vivienda: {
    puntos: [
      { n: 15, titulo: 'Vivienda Lógica', texto: 'Desahucio en 48 h, agilización de licencias y mercado libre para que bajen los precios.' },
      { n: 13, titulo: 'Burocracia Cero y Silencio Positivo', texto: 'Cualquier trámite en menos de 24 h desde el móvil.' },
    ],
  },
  energia: {
    puntos: [
      { n: 28, titulo: 'Prioridad Nacional en Agua y Energía', texto: 'Gestión técnica unificada por encima de las disputas territoriales.' },
      { n: 29, titulo: 'Test de Estrés para Leyes', texto: 'Simular el impacto de cada medida antes de aplicarla.' },
    ],
  },
  empleo_autonomos: {
    puntos: [
      { n: 17, titulo: 'Autónomos «Cuota Cero»', texto: 'Solo se cotiza al superar el umbral de beneficios (~16.000 €).' },
      { n: 19, titulo: 'Incentivo al Valor Humano vs. IA', texto: 'Bonificaciones a las empresas que contraten personas.' },
    ],
  },
  impuestos: {
    puntos: [
      { n: 16, titulo: 'Trazabilidad del Impuesto Personal', texto: 'Cada ciudadano puede auditar en qué se gastan sus impuestos con el DNI-e.' },
      { n: 18, titulo: 'Tributación en Origen', texto: 'Las tecnológicas extranjeras tributan donde operan.' },
      { n: 26, titulo: 'Herencia Cero de Deuda Pública', texto: 'Prohibidos los presupuestos con deuda estructural.' },
    ],
  },
  sanidad: {
    puntos: [
      { n: 14, titulo: 'Auditoría de Gasto Inútil', texto: 'Eliminar la «grasa política»; el ahorro va a Sanidad, Seguridad y Educación.' },
    ],
  },
  inmigracion: {
    puntos: [
      { n: 21, titulo: 'Gestión Lógica de la Inmigración', texto: 'Por capacitación y necesidad real, vinculada al respeto a las leyes.' },
    ],
  },
  agua: {
    puntos: [
      { n: 28, titulo: 'Prioridad Nacional en Agua y Energía', texto: 'Gestión técnica unificada del agua por encima de las disputas territoriales.' },
    ],
  },
  regeneracion: {
    puntos: [
      { n: 7, titulo: 'Rectificación Popular', texto: 'Si el 70 % vota cesar a un cargo corrupto, se cesa de inmediato.' },
      { n: 11, titulo: 'Eliminación de Aforamientos', texto: 'Los políticos responden ante la ley como cualquier ciudadano.' },
      { n: 3, titulo: 'Idoneidad Profesional', texto: 'Test psicotécnicos y CV verificable para los candidatos.' },
      { n: 27, titulo: 'Independencia del CIS', texto: 'El Gobierno no nombra a quien le audita ni a quien hace las estadísticas.' },
    ],
  },
};
