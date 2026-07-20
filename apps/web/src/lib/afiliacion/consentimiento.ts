/**
 * Texto único del mandato SEPA + consentimiento específico de afiliación de
 * pago (distinto del consentimiento Art. 9 general que rc-03 ya recoge en
 * TODA alta de cuenta — ver src/lib/auth/consentimiento.ts). Este es el paso
 * adicional en el momento concreto en que un `registered` se convierte en
 * afiliado de cuota (el hecho que de verdad activa el tratamiento de
 * categoría especial a ojos del RGPD: pasar a pagar y aparecer en el censo
 * de un partido), más la autorización de domiciliación bancaria en sí.
 *
 * El texto del mandato SEPA reglamentario (referencia del acreedor, esquema
 * CORE) lo añade el propio Checkout de Stripe cuando `sepa_debit` está
 * activo en la cuenta — Stripe es el "acreedor" a efectos de recaudo y tiene
 * la obligación legal de mostrarlo. Este texto es el aviso PREVIO nuestro,
 * antes de llegar a Stripe.
 */
export const TEXTO_CONSENTIMIENTO_AFILIACION = `Voy a convertirme en afiliado/a de pago de Razón Común. Entiendo que esto implica: (1) que mi afiliación queda registrada como dato de categoría especial (art. 9 RGPD) y aparezco en el censo interno de votaciones; (2) que autorizo una domiciliación bancaria SEPA recurrente por el importe y periodicidad elegidos, gestionada por Stripe (nuestro procesador de pagos) en nombre de Razón Común como acreedor — el mandato exacto (referencia, esquema CORE, plazos de devolución de 8 semanas) me lo mostrará Stripe en el siguiente paso antes de introducir mi IBAN; (3) que puedo darme de baja cuando quiera desde mi perfil, sin penalización. He leído la política de privacidad.`;

export const TEXTO_AVISO_MANDATO_SEPA = `Al confirmar en el siguiente paso, autorizas a Razón Común a enviar instrucciones a tu entidad bancaria para adeudar tu cuenta, y a tu entidad bancaria a adeudar tu cuenta de acuerdo con esas instrucciones. Tienes derecho a que tu entidad te reembolse de acuerdo con los términos y condiciones de tu contrato con ella; la solicitud de reembolso debe efectuarse dentro de las 8 semanas que siguen a la fecha de adeudo de tu cuenta. Stripe Payments Europe, Ltd. gestiona el cobro como procesador de pagos en nombre de Razón Común.`;

/** Importe legible para la UI ("5,00 €"). */
export function formatearCents(cents: number): string {
  return (cents / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
}
