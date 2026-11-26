export type Veredicto = 'verde' | 'naranja' | 'rojo';

export interface Fuente { nombre: string; url: string }
/** Seguimiento durante la legislatura; en las siguientes elecciones da la credibilidad. */
export type EstadoCumplimiento = 'pendiente' | 'en_curso' | 'cumplida' | 'parcial' | 'incumplida';
export interface Seguimiento { estado: EstadoCumplimiento; fecha?: string | null; nota?: string | null; fuente?: Fuente | null }

export interface PropuestaVerificada {
  texto: string;
  seguimiento?: Seguimiento;
  cita: { pagina: number | null; apartado: string | null; nota?: string | null };
  verificacion: { veredicto: Veredicto; texto: string; fuentes: Fuente[] };
}
export interface Apartado {
  id: string;
  titulo: string;
  dato: { texto: string; fuente: string; url: string } | null;
  programas: Record<string, { url: string | null; verificado2026?: boolean }>;
  propuestas: Record<string, PropuestaVerificada[]>;
}
export interface Partido { id: string; sigla: string; nombre: string; color: string }

/** Color de cada apartado, del espectro del aro (identidad visual). */
export const COLOR_APARTADO: Record<string, string> = {
  vivienda: '#16B8A0', energia: '#E8792F', inmigracion: '#8B30D9', turismo: '#2BC7E8',
  sanidad: '#C3369E', educacion: '#5B4BD6', trabajo: '#0E9C8A', autonomos: '#D65F1F', economia: '#1B3D9C',
};

export const PARTIDOS: Partido[] = [
  { id: 'pp', sigla: 'PP', nombre: 'PP', color: '#1D84CE' },
  { id: 'psoe', sigla: 'PSOE', nombre: 'PSOE', color: '#E30613' },
  { id: 'vox', sigla: 'VOX', nombre: 'Vox', color: '#63BE21' },
  { id: 'fa', sigla: 'FA', nombre: 'Frente Amplio', color: '#D6336C' },
];

export interface PropuestaRc {
  titulo: string;
  texto: string;
  punto: number | null;
  dato: { texto: string; fuente: string; url: string } | null;
  medicion: string;
  competencia: string;
  verificacion: { veredicto: Veredicto; texto: string; fuentes: Fuente[] };
  seguimiento?: Seguimiento;
}
export interface ApartadoRc { id: string; propuestas: PropuestaRc[] }
