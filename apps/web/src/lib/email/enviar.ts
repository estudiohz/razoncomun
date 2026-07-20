import nodemailer from 'nodemailer';

/**
 * Envío de correo transaccional propio de afiliación (bienvenida, dunning,
 * encuesta de baja) — reutiliza el MISMO transporte que ya usa GoTrue para
 * los correos de auth (Brevo, 300/día, rc-03): mismas credenciales SMTP,
 * pero leídas bajo el namespace propio `RC_SMTP_*` para no acoplar este
 * código (arranca en cualquier request de la app, no solo en el arranque de
 * GoTrue) a las env vars de infraestructura de Supabase. Es la MISMA cuota
 * Brevo (no hay cuota separada por credencial SMTP dentro de una cuenta):
 * ambos flujos comparten el límite de 300 correos/día del plan gratuito.
 *
 * Si faltan credenciales (entorno de desarrollo sin `.env.local` completo),
 * NO lanza — registra en consola y devuelve `{ enviado: false }` para que el
 * webhook nunca falle por un correo (Stripe espera 200 rápido).
 */
let transportador: nodemailer.Transporter | null = null;

function obtenerTransportador(): nodemailer.Transporter | null {
  const host = process.env.RC_SMTP_HOST;
  const port = process.env.RC_SMTP_PORT;
  const user = process.env.RC_SMTP_USER;
  const pass = process.env.RC_SMTP_PASS;

  if (!host || !port || !user || !pass) return null;

  if (!transportador) {
    transportador = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: Number(port) === 465,
      auth: { user, pass },
    });
  }
  return transportador;
}

export async function enviarCorreo(opts: {
  para: string;
  asunto: string;
  html: string;
  texto: string;
}): Promise<{ enviado: boolean; motivo?: string }> {
  const transporte = obtenerTransportador();
  if (!transporte) {
    console.warn(
      `[email] RC_SMTP_* no configurado — correo "${opts.asunto}" a ${opts.para} NO enviado (ver AFILIACION-SETUP.md).`,
    );
    return { enviado: false, motivo: 'smtp_no_configurado' };
  }

  try {
    await transporte.sendMail({
      from: `"${process.env.RC_SMTP_SENDER_NAME ?? 'Razón Común'}" <${process.env.RC_SMTP_ADMIN_EMAIL ?? process.env.RC_SMTP_USER}>`,
      to: opts.para,
      subject: opts.asunto,
      html: opts.html,
      text: opts.texto,
    });
    return { enviado: true };
  } catch (err) {
    console.error(`[email] Fallo al enviar "${opts.asunto}" a ${opts.para}:`, (err as Error).message);
    return { enviado: false, motivo: (err as Error).message };
  }
}
