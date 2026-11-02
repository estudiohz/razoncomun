import { describe, expect, it } from 'vitest';
import { correoEncuestaInicio, correoEncuestaRecordatorio, type DatosCorreoEncuesta } from './plantillas';
import { diasHasta, mesDe, nombreMes } from './campanas';

const base: DatosCorreoEncuesta = {
  sitio: 'https://razoncomun.com',
  nombre: 'Lucía',
  mes: 'noviembre',
  tituloEncuesta: 'Vivienda <y> alquiler',
  cierre: '30 de noviembre',
  diasRestantes: 5,
  preguntasPendientes: 8,
  preguntasTotales: 8,
  urlBaja: 'https://razoncomun.com/baja-avisos?u=1&t=2',
};

describe('correo de inicio', () => {
  it('personaliza el asunto, escapa el título y lleva baja, imagen y propuestas', () => {
    const c = correoEncuestaInicio(base);
    expect(c.asunto).toBe('Lucía, la encuesta de noviembre ya está abierta');
    expect(c.html).toContain('Vivienda &lt;y&gt; alquiler');
    expect(c.html).toContain(base.urlBaja);
    expect(c.html).toContain('/email-participa.jpg');
    expect(c.html).toContain('/propuestas/nueva');
    expect(c.texto).toContain('Dejar de recibir estos avisos');
  });
  it('sin nombre no deja la coma colgando', () => {
    expect(correoEncuestaInicio({ ...base, nombre: null }).asunto).toBe('La encuesta de noviembre ya está abierta');
  });
});

describe('recordatorio', () => {
  it('a quien no ha empezado: «Falta tu voz» y días restantes', () => {
    const c = correoEncuestaRecordatorio(base);
    expect(c.asunto).toBe('Quedan 5 días para la encuesta de noviembre');
    expect(c.html).toContain('Falta tu voz');
  });
  it('a quien la dejó a medias: «Te falta poco» con las preguntas que quedan', () => {
    const c = correoEncuestaRecordatorio({ ...base, preguntasPendientes: 3 });
    expect(c.html).toContain('Te falta poco');
    expect(c.texto).toContain('quedan 3 preguntas');
  });
  it('un solo día en singular', () => {
    expect(correoEncuestaRecordatorio({ ...base, diasRestantes: 1 }).asunto).toBe('Queda 1 día para la encuesta de noviembre');
  });
});

describe('fechas', () => {
  it('el mes se calcula en hora de Madrid', () => {
    expect(mesDe(new Date('2026-11-30T23:30:00Z'))).toBe('2026-12');
    expect(nombreMes('2026-12')).toBe('diciembre');
  });
  it('días hasta el cierre, nunca menos de 1', () => {
    const ahora = new Date('2026-11-25T08:00:00Z');
    expect(diasHasta('2026-11-30T22:59:00Z', ahora)).toBe(6);
    expect(diasHasta('2026-11-25T09:00:00Z', ahora)).toBe(1);
  });
});
