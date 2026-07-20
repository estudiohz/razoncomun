import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Certificado fiscal anual de cuotas de afiliación (docs/tecnico/afiliados-y-transparencia.md,
 * vision-plataforma.md Pilar 2.1). Las cuotas a partidos desgravan en el IRPF
 * (20%, límite 600€/año, art. 12 LO 8/2007) — el partido debe emitir este
 * certificado y presentar el Modelo 182 (ver `modelo182.ts`).
 *
 * ⚠️ HUECO CONOCIDO (declarado en el informe final, no oculto): el esquema
 * de `profiles` (dueño único: rc-02, no se toca desde aquí) NO tiene columna
 * de NIF/DNI — no se recogió en el alta. Hacienda exige el NIF del
 * beneficiario en el Modelo 182. El PDF dej a el campo en blanco para que el
 * propio afiliado lo rellene a mano antes de presentarlo, y el CSV del
 * Modelo 182 (`modelo182.ts`) lo deja vacío con una columna de aviso — no es
 * un parche silencioso, es una limitación real que necesita que rc-02 (o
 * Sergio) decida dónde vive ese dato antes de ir a producción.
 */

const ENTIDAD = {
  nombre: 'Razón Común',
  descripcion: 'Partido político inscrito en el Registro de Partidos Políticos del Ministerio del Interior',
  // Placeholders — Sergio debe confirmar CIF y domicilio fiscal reales antes de emitir certificados de verdad.
  cif: '[CIF PENDIENTE DE CONFIRMAR]',
  domicilio: '[Domicilio fiscal pendiente de confirmar]',
};

export type DatosCertificado = {
  year: number;
  nombreAfiliado: string;
  emailAfiliado: string;
  totalCents: number;
  numeroCuotas: number;
  fechaEmision: Date;
};

/**
 * Suma las cuotas realmente COBRADAS (invoices pagadas) de un afiliado en un
 * año natural, consultando Stripe directamente — no hay tabla espejo de
 * facturas (fuera del alcance del esquema de rc-02), así que Stripe es la
 * fuente de verdad para este cálculo. Filtra por `status: 'paid'` y por la
 * fecha de creación de la factura dentro del año.
 */
export async function calcularCuotasDelAnio(
  stripe: Stripe,
  stripeCustomerId: string,
  year: number,
): Promise<{ totalCents: number; numeroCuotas: number }> {
  const desde = Math.floor(new Date(Date.UTC(year, 0, 1)).getTime() / 1000);
  const hasta = Math.floor(new Date(Date.UTC(year + 1, 0, 1)).getTime() / 1000);

  let totalCents = 0;
  let numeroCuotas = 0;
  let startingAfter: string | undefined;

  // Paginación defensiva (un afiliado de cuota mensual tiene como mucho 12
  // facturas/año — esto nunca debería iterar más de una página, pero no
  // asumimos límites de Stripe).
  for (let pagina = 0; pagina < 10; pagina++) {
    const pagina_datos: Stripe.Invoice[] = await stripe.invoices
      .list({ customer: stripeCustomerId, status: 'paid', limit: 100, starting_after: startingAfter })
      .then((r) => r.data);

    for (const inv of pagina_datos) {
      if (inv.created >= desde && inv.created < hasta) {
        totalCents += inv.amount_paid;
        numeroCuotas += 1;
      }
    }

    if (pagina_datos.length < 100) break;
    startingAfter = pagina_datos[pagina_datos.length - 1]?.id;
    if (!startingAfter) break;
  }

  return { totalCents, numeroCuotas };
}

export async function datosCertificado(
  admin: SupabaseClient,
  stripe: Stripe,
  userId: string,
  year: number,
): Promise<DatosCertificado | null> {
  const [{ data: perfil }, { data: miembro }] = await Promise.all([
    admin.from('profiles').select('display_name, email').eq('id', userId).single(),
    admin.from('members').select('stripe_customer_id').eq('user_id', userId).maybeSingle(),
  ]);

  if (!perfil || !miembro?.stripe_customer_id) return null;

  const { totalCents, numeroCuotas } = await calcularCuotasDelAnio(stripe, miembro.stripe_customer_id, year);
  if (numeroCuotas === 0) return null;

  return {
    year,
    nombreAfiliado: perfil.display_name ?? perfil.email ?? 'Afiliado/a',
    emailAfiliado: perfil.email ?? '',
    totalCents,
    numeroCuotas,
    fechaEmision: new Date(),
  };
}

function euros(cents: number): string {
  return (cents / 100).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Genera el PDF del certificado (una página, A4). */
export async function generarCertificadoPDF(datos: DatosCertificado): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const pagina = doc.addPage([595.28, 841.89]); // A4 en puntos
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const azul = rgb(0x1b / 255, 0x3d / 255, 0x9c / 255);
  const gris = rgb(0x5a / 255, 0x67 / 255, 0x80 / 255);
  const negro = rgb(0.12, 0.12, 0.14);

  let y = 780;
  const margenX = 60;

  pagina.drawText(ENTIDAD.nombre, { x: margenX, y, size: 22, font: fontBold, color: azul });
  y -= 18;
  pagina.drawText(ENTIDAD.descripcion, { x: margenX, y, size: 9, font, color: gris });
  y -= 12;
  pagina.drawText(`CIF: ${ENTIDAD.cif} · ${ENTIDAD.domicilio}`, { x: margenX, y, size: 9, font, color: gris });

  y -= 50;
  pagina.drawText(`CERTIFICADO DE CUOTAS DE AFILIACIÓN — EJERCICIO ${datos.year}`, {
    x: margenX,
    y,
    size: 14,
    font: fontBold,
    color: negro,
  });

  y -= 40;
  const parrafo = [
    `${ENTIDAD.nombre} certifica que:`,
    '',
    `D./Dña. ${datos.nombreAfiliado} (${datos.emailAfiliado}), NIF: ______________________`,
    '',
    `ha satisfecho durante el ejercicio ${datos.year} un total de ${datos.numeroCuotas} cuota(s) de`,
    `afiliación a este partido político, por un importe total de ${euros(datos.totalCents)} €.`,
    '',
    'De acuerdo con el artículo 12 de la Ley Orgánica 8/2007, de 4 de julio, sobre',
    'financiación de los partidos políticos, y la normativa del Impuesto sobre la Renta',
    'de las Personas Físicas, estas cuotas dan derecho a una deducción del 20% de las',
    'cantidades satisfechas, con el límite de 600 € anuales.',
    '',
    `Este certificado se emite a los efectos oportunos ante la Agencia Tributaria.`,
  ];

  for (const linea of parrafo) {
    pagina.drawText(linea, { x: margenX, y, size: 10.5, font, color: negro });
    y -= 18;
  }

  y -= 30;
  pagina.drawText(
    `Emitido electrónicamente el ${datos.fechaEmision.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })}.`,
    { x: margenX, y, size: 9.5, font, color: gris },
  );
  y -= 14;
  pagina.drawText('Documento generado automáticamente a partir de los registros de cobro de Stripe.', {
    x: margenX,
    y,
    size: 8.5,
    font,
    color: gris,
  });

  return doc.save();
}
