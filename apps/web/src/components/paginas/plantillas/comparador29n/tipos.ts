export type Veredicto = 'verde' | 'naranja' | 'rojo' | 'gris';

/** Datos descriptivos que NO cambian el color (el círculo solo mide lo jurídico y competencial). */
export interface Ficha {
  competencia?: string | null;
  coste?: { estado: 'cifra' | 'partido_no_da' | 'sin_estimacion_oficial' | 'pendiente'; texto?: string | null; fuente?: Fuente | null } | null;
  plazo?: string | null;
}

export interface Fuente { nombre: string; url: string }
/** Seguimiento durante la legislatura; en las siguientes elecciones da la credibilidad. */
export type EstadoCumplimiento = 'pendiente' | 'en_curso' | 'cumplida' | 'parcial' | 'incumplida';
export interface Seguimiento { estado: EstadoCumplimiento; fecha?: string | null; nota?: string | null; fuente?: Fuente | null }

export interface Viabilidad {
  coste: string | null;
  texto: string;
  precedentes: { pais: string; resultado: string; url: string }[];
  fuentes: Fuente[];
}

export interface PropuestaVerificada {
  viabilidad?: Viabilidad;
  texto: string;
  seguimiento?: Seguimiento;
  cita: { pagina: number | null; apartado: string | null; nota?: string | null };
  verificacion: { veredicto: Veredicto; texto: string; fuentes: Fuente[] };
  ficha?: Ficha;
}
export interface Apartado {
  id: string;
  titulo: string;
  dato: { texto: string; fuente: string; url: string } | null;
  programas: Record<string, { url: string | null; verificado2026?: boolean }>;
  propuestas: Record<string, PropuestaVerificada[]>;
}
export interface Partido { id: string; sigla: string; nombre: string; color: string; pdf?: string }

/** Color de cada apartado, del espectro del aro (identidad visual). */
export const COLOR_APARTADO: Record<string, string> = {
  vivienda: '#16B8A0', energia: '#E8792F', inmigracion: '#8B30D9', turismo: '#2BC7E8',
  sanidad: '#C3369E', educacion: '#5B4BD6', trabajo: '#0E9C8A', autonomos: '#D65F1F', economia: '#1B3D9C',
  pensiones: '#9B2C8F', corrupcion: '#6D28D9', medioambiente: '#2F9E44',
};

export const PARTIDOS: Partido[] = [
  { id: 'pp', sigla: 'PP', nombre: 'PP', color: '#1D84CE', pdf: 'https://www.pp.es/wp-content/uploads/2026/11/PROGRAMA-ELECTORAL-PP-2026-RECONSTRUCCION-NACIONAL.pdf' },
  { id: 'psoe', sigla: 'PSOE', nombre: 'PSOE', color: '#E30613', pdf: 'https://www.psoe.es/media-content/2026/11/PROGRAMAPSOE29N26.pdf' },
  { id: 'vox', sigla: 'VOX', nombre: 'Vox', color: '#63BE21', pdf: 'https://www.voxespana.es/wp-content/uploads/2026/11/Programa-completo-A5-1.pdf' },
  { id: 'fa', sigla: 'FA', nombre: 'Frente Amplio', color: '#D6336C', pdf: 'https://frenteamplio.info/pdf/ProgramaFrenteAmplio.pdf' },
];

export interface PropuestaRc {
  titulo: string;
  texto: string;
  punto: number | null;
  dato: { texto: string; fuente: string; url: string } | null;
  medicion: string;
  competencia: string;
  verificacion: { veredicto: Veredicto; texto: string; fuentes: Fuente[] };
  viabilidad?: Viabilidad;
  seguimiento?: Seguimiento;
}
export interface ApartadoRc { id: string; propuestas: PropuestaRc[] }
