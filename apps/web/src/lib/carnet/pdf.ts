import { PDFDocument, StandardFonts, rgb, LineCapStyle, type PDFPage, type PDFFont } from 'pdf-lib';
import QRCode from 'qrcode';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { DatosCarnet } from './modelo';

/**
 * El carnet como PDF: el pase VERTICAL que aprobó Sergio (bocetos-carnet/),
 * no la tarjeta apaisada de la primera versión del documento.
 *
 * Es lo que se lleva un iPhone mientras no haya `.pkpass` (D-C1), y sirve
 * igual de imprimible. Vertical porque es la forma de un pase de wallet y la
 * de algo que se enseña en la mano, no la de una tarjeta de crédito.
 *
 * TIPOGRAFÍA: Helvetica, no Montserrat. `pdf-lib` solo trae las fuentes
 * estándar del PDF y en el repo no hay ningún `.ttf` — mismo compromiso que
 * ya asumió el certificado fiscal. Embeber Montserrat es meter un fichero de
 * fuente al repo y una línea aquí; queda anotado como pendiente, no olvidado.
 */

// Proporción del boceto (300 × 386) llevada a puntos: 300 pt de ancho.
const ANCHO = 300;
const ALTO = 386;

const AZUL = rgb(0x1b / 255, 0x3d / 255, 0x9c / 255);
const TINTA = rgb(0x10 / 255, 0x1c / 255, 0x34 / 255);
const GRIS = rgb(0x77 / 255, 0x77 / 255, 0x77 / 255);

/** Las paradas exactas del degradado del logo (Logotipo/Nuevo Logo/favicon.svg). */
const ESPECTRO: Array<[number, [number, number, number]]> = [
  [0.0, [0x24, 0xaf, 0x9a]],
  [0.2, [0x0e, 0x57, 0xa5]],
  [0.35, [0x0e, 0x57, 0xa5]],
  [0.5, [0x8b, 0x30, 0xd9]],
  [0.65, [0xed, 0x11, 0x56]],
  [0.8, [0xed, 0x21, 0x54]],
  [1.0, [0xed, 0x75, 0x47]],
];

function colorEnEspectro(t: number) {
  let i = 0;
  while (i < ESPECTRO.length - 2 && t > ESPECTRO[i + 1][0]) i++;
  const [t0, c0] = ESPECTRO[i];
  const [t1, c1] = ESPECTRO[i + 1];
  const k = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
  const mez = (a: number, b: number) => (a + (b - a) * k) / 255;
  return rgb(mez(c0[0], c1[0]), mez(c0[1], c1[1]), mez(c0[2], c1[2]));
}

/**
 * La banda de espectro de la cabecera. `pdf-lib` no tiene degradados, así que
 * se pinta como una tira de rectángulos de 1 pt: a este tamaño el ojo no
 * distingue los escalones y evita depender de otra librería.
 */
function bandaEspectro(pagina: PDFPage, y: number, alto: number) {
  for (let x = 0; x < ANCHO; x++) {
    pagina.drawRectangle({
      x, y, width: 1.2, height: alto,
      color: colorEnEspectro(x / (ANCHO - 1)),
    });
  }
}

/**
 * Hexágono con vértices arriba y abajo, como el logo, CENTRADO EN EL ORIGEN.
 *
 * Ojo con `drawSvgPath`: interpreta el trazado en coordenadas SVG, donde la Y
 * crece hacia ABAJO, y lo ancla en el `{x, y}` que se le pase. Si se le dan
 * coordenadas de página (Y hacia arriba) el dibujo acaba fuera del papel y no
 * se ve nada — sin ningún error. Por eso el trazado va relativo al centro y la
 * posición se pasa aparte, con `hexagono()`.
 */
function rutaHexagono(r: number): string {
  const puntos: string[] = [];
  for (let i = 0; i < 6; i++) {
    const ang = (Math.PI / 3) * i - Math.PI / 2;
    puntos.push(`${i === 0 ? 'M' : 'L'} ${(r * Math.cos(ang)).toFixed(2)} ${(r * Math.sin(ang)).toFixed(2)}`);
  }
  return `${puntos.join(' ')} Z`;
}

function hexagono(
  pagina: PDFPage,
  cx: number,
  cy: number,
  r: number,
  color: ReturnType<typeof rgb>,
  opacidad = 1,
) {
  pagina.drawSvgPath(rutaHexagono(r), { x: cx, y: cy, color, opacity: opacidad, borderWidth: 0 });
}

function texto(
  pagina: PDFPage,
  cadena: string,
  opts: { x: number; y: number; size: number; font: PDFFont; color: ReturnType<typeof rgb>; espaciado?: number },
) {
  pagina.drawText(cadena, {
    x: opts.x, y: opts.y, size: opts.size, font: opts.font,
    color: opts.color,
    ...(opts.espaciado ? { characterSpacing: opts.espaciado } : {}),
  });
}

export async function generarCarnetPdf(datos: DatosCarnet): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Carnet de socio · ${datos.numeroSocio}`);
  doc.setAuthor('Razón Común');
  // Sin el nombre en los metadatos: un PDF se comparte y sus propiedades se
  // leen sin abrirlo.
  doc.setSubject('Carnet de socio de Razón Común');

  const pagina = doc.addPage([ANCHO, ALTO]);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const normal = await doc.embedFont(StandardFonts.Helvetica);

  pagina.drawRectangle({ x: 0, y: 0, width: ANCHO, height: ALTO, color: rgb(1, 1, 1) });

  // El logo REAL, no un hexágono dibujado a mano: conserva el degradado de la
  // marca, que un trazado plano en azul pierde. `public/` se copia al contenedor
  // (Dockerfile), así que el fichero existe también en producción. Si algún día
  // faltara, se cae al hexágono vectorial en vez de tumbar la descarga.
  let logo: Awaited<ReturnType<typeof doc.embedPng>> | null = null;
  try {
    logo = await doc.embedPng(await readFile(join(process.cwd(), 'public', 'icono-rc.png')));
  } catch {
    logo = null;
  }

  // Hexágono de fondo, arriba a la derecha, con la posición y el peso que
  // Sergio ajustó en los bocetos: grande, sangrado por el lado, separado de la
  // banda y al 9 % para que sea textura y no un segundo logo.
  if (logo) {
    const lado = 264;
    pagina.drawImage(logo, { x: ANCHO - 158, y: ALTO - 40 - lado, width: lado, height: lado, opacity: 0.09 });
  } else {
    hexagono(pagina, ANCHO - 26, ALTO - 118, 132, AZUL, 0.09);
  }

  bandaEspectro(pagina, ALTO - 10, 10);

  // Cabecera
  if (logo) {
    pagina.drawImage(logo, { x: 22, y: ALTO - 54, width: 26, height: 26 });
  } else {
    hexagono(pagina, 34, ALTO - 40, 13, AZUL);
    hexagono(pagina, 34, ALTO - 40, 7.5, rgb(1, 1, 1));
  }
  texto(pagina, 'RAZÓN COMÚN', { x: 54, y: ALTO - 40, size: 11, font: bold, color: TINTA });
  texto(pagina, 'CARNET DE SOCIO', { x: 54, y: ALTO - 52, size: 6.5, font: normal, color: GRIS, espaciado: 1.2 });

  // Nombre — el elemento tipográfico más grande de la tarjeta.
  const lineas = partirNombre(datos.nombre, bold, 20, ANCHO - 44);
  let y = 196;
  for (const linea of lineas) {
    texto(pagina, linea, { x: 22, y, size: 20, font: bold, color: TINTA });
    y -= 24;
  }

  // Hueco del distintivo: existe SIEMPRE, lleve sello o no, para que el
  // nombre caiga a la misma altura en los dos carnets (decisión de Sergio).
  const yDistintivo = y - 4;
  if (datos.verificado) {
    hexagono(pagina, 30, yDistintivo + 4, 9, AZUL);
    // El check va a trazo, no como carácter: las fuentes estándar del PDF solo
    // codifican WinAnsi y '✓' (U+2713) no está ahí — pdf-lib revienta al
    // intentar escribirlo. Dos líneas dan el mismo resultado y no dependen de
    // ninguna fuente.
    const blanco = rgb(1, 1, 1);
    pagina.drawLine({
      start: { x: 26.2, y: yDistintivo + 4.2 },
      end: { x: 28.6, y: yDistintivo + 1.6 },
      thickness: 1.5, color: blanco, lineCap: LineCapStyle.Round,
    });
    pagina.drawLine({
      start: { x: 28.6, y: yDistintivo + 1.6 },
      end: { x: 33.6, y: yDistintivo + 7.6 },
      thickness: 1.5, color: blanco, lineCap: LineCapStyle.Round,
    });
    texto(pagina, 'Socio verificado', { x: 44, y: yDistintivo, size: 9.5, font: bold, color: TINTA });
  }

  // Datos, en fila
  const yDatos = yDistintivo - 34;
  texto(pagina, 'SOCIO N.º', { x: 22, y: yDatos + 14, size: 6.5, font: bold, color: GRIS, espaciado: 1.2 });
  texto(pagina, datos.numeroSocio, { x: 22, y: yDatos, size: 16, font: bold, color: AZUL });

  if (datos.socioDesde) {
    texto(pagina, 'SOCIO DESDE', { x: 118, y: yDatos + 14, size: 6.5, font: bold, color: GRIS, espaciado: 1.2 });
    texto(pagina, datos.socioDesde, { x: 118, y: yDatos, size: 11, font: normal, color: TINTA });
  }

  // QR abajo a la derecha
  const qrPng = await QRCode.toBuffer(datos.urlVerificacion, {
    type: 'png', margin: 0, width: 400,
    color: { dark: '#101C34', light: '#FFFFFF' },
  });
  const qr = await doc.embedPng(qrPng);
  const ladoQr = 82;
  pagina.drawImage(qr, { x: ANCHO - 22 - ladoQr, y: 22, width: ladoQr, height: ladoQr });

  texto(pagina, 'Escanea para comprobar', { x: 22, y: 74, size: 7, font: normal, color: GRIS });
  texto(pagina, 'la validez en', { x: 22, y: 65, size: 7, font: normal, color: GRIS });
  texto(pagina, 'razoncomun.com', { x: 22, y: 56, size: 7, font: normal, color: GRIS });

  return doc.save();
}

/** Parte el nombre por palabras para que no se salga de la tarjeta. */
function partirNombre(nombre: string, font: PDFFont, size: number, ancho: number): string[] {
  const palabras = nombre.split(/\s+/).filter(Boolean);
  const lineas: string[] = [];
  let actual = '';

  for (const palabra of palabras) {
    const intento = actual ? `${actual} ${palabra}` : palabra;
    if (font.widthOfTextAtSize(intento, size) <= ancho) {
      actual = intento;
    } else {
      if (actual) lineas.push(actual);
      actual = palabra;
    }
  }
  if (actual) lineas.push(actual);

  // Más de tres líneas desbordarían por abajo: se corta con puntos suspensivos
  // antes que romper la composición.
  if (lineas.length > 3) return [...lineas.slice(0, 2), `${lineas[2]}…`];
  return lineas;
}
