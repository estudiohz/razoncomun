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
 * CORE) lo añade el propio Payment Element de Stripe cuando la persona elige
 * domiciliación — Stripe es el "acreedor" a efectos de recaudo y tiene la
 * obligación legal de mostrarlo. Este texto es el aviso PREVIO nuestro, antes
 * de llegar a Stripe.
 *
 * DOS MÉTODOS (04/09/2026): desde que Sergio activó `sepa_debit` en la cuenta
 * conviven domiciliación y tarjeta, y elige la persona. Eso obliga a que el
 * consentimiento hable de LOS DOS: se firma ANTES de elegir método —el orden
 * es consentimiento, luego Stripe— así que un texto que solo mencionara la
 * domiciliación estaría describiendo algo que puede no ocurrir. El aviso
 * específico del mandato SEPA se mantiene aparte y condicionado, porque solo
 * aplica a quien domicilie.
 */
export const TEXTO_CONSENTIMIENTO_AFILIACION = `Voy a convertirme en socio/a de pago de Razón Común. Entiendo que esto implica: (1) que mi condición de socio/a queda registrada como dato de categoría especial (art. 9 RGPD) y aparezco en el censo interno de votaciones; (2) que autorizo un cobro recurrente por el importe y la periodicidad que elija, gestionado por Stripe (nuestro procesador de pagos) en nombre de Razón Común, con el método de pago que yo seleccione en el paso siguiente — si elijo domiciliación bancaria, autorizo el adeudo SEPA y Stripe me mostrará el mandato exacto (referencia, esquema CORE y plazo de devolución de 8 semanas) antes de introducir mi IBAN; si elijo tarjeta, autorizo el cargo periódico en ella; (3) que puedo darme de baja cuando quiera desde mi panel, sin penalización, y que el cobro se detiene desde ese momento. He leído la política de privacidad.`;

/**
 * Solo aplica a quien elija domiciliación. Se muestra encabezado por esa
 * condición: prometerle a alguien que paga con tarjeta un reembolso "en 8
 * semanas por su entidad bancaria" sería sencillamente falso.
 */
export const TEXTO_AVISO_MANDATO_SEPA = `Si eliges domiciliación bancaria: al confirmar autorizas a Razón Común a enviar instrucciones a tu entidad bancaria para adeudar tu cuenta, y a tu entidad bancaria a adeudar tu cuenta de acuerdo con esas instrucciones. Tienes derecho a que tu entidad te reembolse de acuerdo con los términos y condiciones de tu contrato con ella; la solicitud de reembolso debe efectuarse dentro de las 8 semanas que siguen a la fecha de adeudo de tu cuenta. Stripe Payments Europe, Ltd. gestiona el cobro como procesador de pagos en nombre de Razón Común.`;

/**
 * ¿Es un nombre completo? Al menos dos palabras de dos letras.
 *
 * Se usa en el alta porque este nombre acaba en el carnet de socio y en el
 * certificado fiscal que va a Hacienda: "Sergio" a secas no sirve para
 * ninguno de los dos. No pretende validar que el nombre sea REAL —eso no se
 * puede desde aquí— solo que no falten los apellidos.
 */
export function esNombreCompleto(nombre: string): boolean {
  return nombre.trim().split(/\s+/).filter((p) => p.length >= 2).length >= 2;
}

/** Importe legible para la UI ("5,00 €"). */
export function formatearCents(cents: number): string {
  return (cents / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
}
