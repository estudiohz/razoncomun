import { envoltorio } from '@/lib/email/plantillas';

/**
 * Correos de participación (docs/tecnico/newsletter.md, copy aprobado).
 * Una sola llamada principal por correo; el bloque de propuestas es la
 * secundaria. Todo valor que venga de la base de datos se escapa.
 */

export interface DatosCorreoEncuesta {
  sitio: string;
  nombre: string | null;
  /** «noviembre» */
  mes: string;
  tituloEncuesta: string;
  /** «30 de noviembre» */
  cierre: string;
  diasRestantes: number;
  /** Preguntas que le faltan; 0 o igual al total si no ha empezado. */
  preguntasPendientes: number;
  preguntasTotales: number;
  urlBaja: string;
}

export interface CorreoRenderizado {
  asunto: string;
  html: string;
  texto: string;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const P = 'margin:0 0 16px;font-size:15px;line-height:1.7;color:#232A3B;';

function boton(url: string, texto: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;"><tr><td bgcolor="#1B3D9C" style="border-radius:10px;">
      <a href="${url}" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:700;color:#FFFFFF;">${texto}</a>
    </td></tr></table>`;
}

function bloquePropuestas(sitio: string): { html: string; texto: string } {
  return {
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 0;"><tr><td bgcolor="#F4F8FD" style="background:#F4F8FD;border-radius:12px;padding:22px 24px;">
      <p style="margin:0 0 8px;font-size:16px;font-weight:800;color:#232A3B;">¿Tienes una idea mejor?</p>
      <p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:#232A3B;">En Razón Común no eres público: eres parte del proyecto. Propón, comenta y vota las ideas de otros socios. Las que más apoyo reciben se estudian con datos y pueden acabar en el programa.</p>
      <a href="${sitio}/propuestas" style="font-size:14px;font-weight:700;color:#1B3D9C;">Ver propuestas</a>
      <span style="color:#9AA6BC;">&nbsp;·&nbsp;</span>
      <a href="${sitio}/propuestas/nueva" style="font-size:14px;font-weight:700;color:#1B3D9C;">Proponer una idea</a>
    </td></tr></table>`,
    texto:
      `¿TIENES UNA IDEA MEJOR?\nEn Razón Común no eres público: eres parte del proyecto. Propón, comenta y vota las ideas de otros socios. ` +
      `Las que más apoyo reciben se estudian con datos y pueden acabar en el programa.\nVer propuestas: ${sitio}/propuestas\nProponer una idea: ${sitio}/propuestas/nueva`,
  };
}

function pie(d: DatosCorreoEncuesta): { html: string; texto: string } {
  return {
    html: `Recibes este correo porque tienes cuenta en Razón Común. <a href="${d.urlBaja}" style="color:#5A6780;text-decoration:underline;">Dejar de recibir estos avisos</a> · <a href="${d.sitio}/panel/perfil" style="color:#5A6780;text-decoration:underline;">Preferencias</a>`,
    texto: `Recibes este correo porque tienes cuenta en Razón Común.\nDejar de recibir estos avisos: ${d.urlBaja}`,
  };
}

const imagen = (sitio: string) => ({
  url: `${sitio}/email-participa.jpg`,
  alt: 'Personas de Razón Común',
  alto: 240,
});

const saludo = (nombre: string | null) => (nombre?.trim() ? `Hola, ${nombre.trim()}:` : 'Hola:');

/** Día 1: la encuesta del mes está abierta. */
export function correoEncuestaInicio(d: DatosCorreoEncuesta): CorreoRenderizado {
  const nombre = d.nombre?.trim();
  const mes = esc(d.mes);
  const titulo = esc(d.tituloEncuesta);
  const url = `${d.sitio}/mes`;
  const prop = bloquePropuestas(d.sitio);
  const p = pie(d);

  const asunto = nombre ? `${nombre}, la encuesta de ${d.mes} ya está abierta` : `La encuesta de ${d.mes} ya está abierta`;
  const html = envoltorio(
    `Encuesta de ${mes}`,
    'Este mes, decides tú',
    `<p style="${P}">${esc(saludo(d.nombre))}</p>
    <p style="${P}">Ya está abierta la encuesta de <strong>${mes}: ${titulo}</strong>.</p>
    <p style="${P}">En los partidos de siempre, unos pocos deciden y el resto se entera por la tele. Aquí funciona al revés: las respuestas de cada encuesta pasan al programa, se publican y se tienen en cuenta. Sin tu voz, el resultado lo marcan otros.</p>
    <p style="${P}">Te lleva unos cinco minutos. Y si no te da tiempo de una vez, puedes dejarla a medias: guardamos lo que contestes.</p>
    ${boton(url, 'Responder la encuesta →')}
    <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#5A6780;">La democracia directa no es votar cada cuatro años. Es esto: participar, mes a mes, en lo que importa.</p>
    ${prop.html}`,
    { preheader: 'Cinco minutos tuyos deciden hacia dónde va Razón Común.', imagen: imagen(d.sitio), pieHtml: p.html },
  );
  const texto = [
    saludo(d.nombre),
    `Ya está abierta la encuesta de ${d.mes}: ${d.tituloEncuesta}.`,
    'En los partidos de siempre, unos pocos deciden y el resto se entera por la tele. Aquí funciona al revés: las respuestas de cada encuesta pasan al programa, se publican y se tienen en cuenta. Sin tu voz, el resultado lo marcan otros.',
    'Te lleva unos cinco minutos. Y si no te da tiempo de una vez, puedes dejarla a medias: guardamos lo que contestes.',
    `Responder la encuesta: ${url}`,
    'La democracia directa no es votar cada cuatro años. Es esto: participar, mes a mes, en lo que importa.',
    prop.texto,
    '— Razón Común',
    p.texto,
  ].join('\n\n');
  return { asunto, html, texto };
}

/** Día 25: solo a quien no ha terminado. Variante si la dejó a medias. */
export function correoEncuestaRecordatorio(d: DatosCorreoEncuesta): CorreoRenderizado {
  const mes = esc(d.mes);
  const cierre = esc(d.cierre);
  const url = `${d.sitio}/mes`;
  const prop = bloquePropuestas(d.sitio);
  const p = pie(d);
  const aMedias = d.preguntasPendientes > 0 && d.preguntasPendientes < d.preguntasTotales;
  const dias = d.diasRestantes === 1 ? 'Queda 1 día' : `Quedan ${d.diasRestantes} días`;

  const asunto = aMedias ? `Te falta poco: termina la encuesta de ${d.mes}` : `${dias} para la encuesta de ${d.mes}`;
  const preheader = aMedias ? `Te quedan ${d.preguntasPendientes} preguntas. Cierra el ${d.cierre}.` : `Aún no tenemos tu respuesta. Cierra el ${d.cierre}.`;
  const parrafo1 = aMedias
    ? `Empezaste la encuesta de <strong>${mes}</strong> y te ${d.preguntasPendientes === 1 ? 'queda <strong>1 pregunta</strong>' : `quedan <strong>${d.preguntasPendientes} preguntas</strong>`}. Termínala antes del <strong>${cierre}</strong>.`
    : `La encuesta de <strong>${mes}</strong> cierra el <strong>${cierre}</strong> y todavía no tenemos tu respuesta.`;

  const html = envoltorio(
    'Últimos días',
    aMedias ? 'Te falta poco' : 'Falta tu voz',
    `<p style="${P}">${esc(saludo(d.nombre))}</p>
    <p style="${P}">${parrafo1}</p>
    <p style="${P}">Cada respuesta pesa. Cuando se cierre, los resultados se publican y pasan a formar parte de las decisiones de Razón Común. Si no estás dentro, se decidirá sin ti.</p>
    <p style="${P}"><strong>Cinco minutos. Ahora.</strong></p>
    ${boton(url, aMedias ? 'Terminar la encuesta →' : 'Responder antes de que cierre →')}
    <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#5A6780;">Transparencia y democracia directa no se defienden con discursos: se defienden participando.</p>
    ${prop.html}`,
    { preheader, imagen: imagen(d.sitio), pieHtml: p.html },
  );
  const texto = [
    saludo(d.nombre),
    parrafo1.replace(/<[^>]+>/g, ''),
    'Cada respuesta pesa. Cuando se cierre, los resultados se publican y pasan a formar parte de las decisiones de Razón Común. Si no estás dentro, se decidirá sin ti.',
    'Cinco minutos. Ahora.',
    `${aMedias ? 'Terminar la encuesta' : 'Responder'}: ${url}`,
    'Transparencia y democracia directa no se defienden con discursos: se defienden participando.',
    prop.texto,
    '— Razón Común',
    p.texto,
  ].join('\n\n');
  return { asunto, html, texto };
}
