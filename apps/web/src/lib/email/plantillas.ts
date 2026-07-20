/**
 * Plantillas de correo transaccional de afiliación. Tono de marca: directo,
 * sin rodeos, empoderador (CLAUDE.md raíz). HTML tabla-based (compatible
 * Outlook), texto plano siempre incluido.
 *
 * Reutiliza la MISMA estética que las 5 plantillas GoTrue de rc-03
 * (`lib/auth/email-templates/gotrue/*.html`): banda superior con degradado
 * del aro + logo blanco, tarjeta blanca con el cuerpo, pie discreto. Mismo
 * `envoltorio()` conceptual, adaptado a función TS porque estas plantillas
 * las genera el propio código (no GoTrue) con datos dinámicos por evento.
 */
import { formatearCents } from '@/lib/afiliacion/consentimiento';

function envoltorio(eyebrow: string, tituloHtml: string, cuerpoHtml: string): string {
  return `<!doctype html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>Razón Común</title>
<style>
  body,table,td{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
  body{margin:0;padding:0;width:100% !important;background:#F4F8FD;}
  a{text-decoration:none;}
  @media screen and (max-width:600px){.rc-container{width:100% !important;}.rc-px{padding-left:20px !important;padding-right:20px !important;}}
</style>
</head>
<body style="margin:0;padding:0;background:#F4F8FD;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F8FD;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="rc-container" style="width:600px;max-width:600px;">
        <tr>
          <td align="center" bgcolor="#8B30D9" style="background:#8B30D9;background-image:linear-gradient(120deg,#1B3D9C 0%,#8B30D9 28%,#C3369E 50%,#E8792F 72%,#16B8A0 100%);padding:26px 0;border-radius:14px 14px 0 0;">
            <img src="https://dev-api.razoncomun.com/storage/v1/object/public/marca/logo-rc-blanco.png" width="220" height="66" alt="Razón Común" style="display:block;border:0;outline:none;">
          </td>
        </tr>
        <tr>
          <td class="rc-px" bgcolor="#FFFFFF" style="background:#FFFFFF;border:1px solid #E2E9F5;border-top:none;border-radius:0 0 14px 14px;padding:36px 40px 32px;font-family:Montserrat,'Segoe UI',Arial,Helvetica,sans-serif;">
            <p style="margin:0 0 6px;font-size:12.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#1B3D9C;">${eyebrow}</p>
            <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;font-weight:800;color:#232A3B;">${tituloHtml}</h1>
            ${cuerpoHtml}
          </td>
        </tr>
        <tr>
          <td class="rc-px" style="padding:20px 40px 0;font-family:Montserrat,'Segoe UI',Arial,Helvetica,sans-serif;">
            <p style="margin:0;font-size:12px;line-height:1.6;color:#5A6780;">Razón Común — partido político inscrito en el Registro del Ministerio del Interior. Este correo es transaccional (afiliación), no publicitario.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function correoBienvenida(opts: { nombre: string | null; periodo: 'monthly' | 'annual'; amountCents: number }) {
  const nombre = opts.nombre?.trim() || 'afiliado/a';
  const periodoTexto = opts.periodo === 'monthly' ? 'mensual' : 'anual';
  const asunto = 'Bienvenido/a a Razón Común — ya eres afiliado/a';
  const texto = `Hola ${nombre},\n\nTu domiciliación SEPA se ha activado: eres afiliado/a de Razón Común con una cuota ${periodoTexto} de ${formatearCents(opts.amountCents)}.\n\nA partir de ahora puedes:\n- Votar en las propuestas de tu departamento (a los 3 meses de antigüedad).\n- Proponer y debatir en el programa vivo.\n- Auditar en /cuentas cada euro que gestiona el partido.\n\nGestiona tu cuota, cambia de periodicidad o date de baja cuando quieras desde tu perfil.\n\nGracias por sostener con tu cuota una política basada en datos.\n\n— Razón Común`;
  const html = envoltorio(
    'Bienvenido/a',
    `Ya eres afiliado/a, ${nombre}`,
    `<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#232A3B;">Tu domiciliación SEPA se ha activado: eres <strong>afiliado/a de Razón Común</strong> con una cuota <strong>${periodoTexto}</strong> de <strong>${formatearCents(opts.amountCents)}</strong>.</p>
    <p style="margin:0 0 8px;font-size:15px;color:#232A3B;">A partir de ahora puedes:</p>
    <ul style="margin:0 0 24px;padding-left:20px;font-size:14px;line-height:1.7;color:#232A3B;">
      <li>Votar en las propuestas de tu departamento (a los 3 meses de antigüedad).</li>
      <li>Proponer y debatir en el programa vivo.</li>
      <li>Auditar en <a href="https://www.razoncomun.com/cuentas" style="color:#1B3D9C;font-weight:700;">/cuentas</a> cada euro que gestiona el partido.</li>
    </ul>
    <p style="margin:0 0 8px;font-size:14px;color:#5A6780;">Gestiona tu cuota, cambia de periodicidad o date de baja cuando quieras desde tu perfil.</p>
    <p style="margin:0;font-size:14px;color:#5A6780;">Gracias por sostener con tu cuota una política basada en datos.</p>`,
  );
  return { asunto, html, texto };
}

/**
 * Dunning (impago SEPA). El tono sube de amable a informativo según
 * `intento` (invoice.attempt_count de Stripe Smart Retries), nunca
 * amenazante — vision-plataforma.md pide "emails amables".
 */
export function correoImpago(opts: { nombre: string | null; intento: number; amountCents: number }) {
  const nombre = opts.nombre?.trim() || 'afiliado/a';
  const esUltimo = opts.intento >= 3;
  const asunto = esUltimo
    ? 'No hemos podido cobrar tu cuota — última notificación'
    : 'No hemos podido cobrar tu cuota de Razón Común';
  const cuerpo = esUltimo
    ? `Hola ${nombre},\n\nEs el tercer intento y seguimos sin poder cobrar tu domiciliación SEPA de ${formatearCents(opts.amountCents)}. Si no se regulariza, tu afiliación pasará a estado inactivo y perderás el derecho a voto hasta que la reactives.\n\nRevisa tu método de pago desde tu perfil (Customer Portal de Stripe) — no hace falta que hagas nada más, Stripe reintentará automáticamente.\n\nSi ha sido un error de nuestra parte o quieres darte de baja, contesta a este correo, una persona del equipo te atenderá.\n\n— Razón Común`
    : `Hola ${nombre},\n\nHemos intentado cobrar tu cuota de ${formatearCents(opts.amountCents)} por domiciliación SEPA y el banco la ha devuelto. No pasa nada: Stripe reintentará automáticamente en los próximos días.\n\nSi crees que es un error (IBAN caducado, fondos insuficientes puntuales...), puedes revisar tu método de pago desde tu perfil.\n\n— Razón Común`;
  const html = envoltorio(
    esUltimo ? 'Última notificación' : 'Aviso de cobro',
    esUltimo ? 'Última notificación' : 'No hemos podido cobrar tu cuota',
    `<p style="margin:0;font-size:15px;line-height:1.7;color:#232A3B;">${cuerpo.split('\n\n').join('</p><p style="margin:16px 0 0;font-size:15px;line-height:1.7;color:#232A3B;">')}</p>`,
  );
  return { asunto, html, texto: cuerpo };
}

export function correoRecuperado(opts: { nombre: string | null }) {
  const nombre = opts.nombre?.trim() || 'afiliado/a';
  const asunto = 'Todo en orden — tu cuota se ha cobrado';
  const texto = `Hola ${nombre},\n\nTu domiciliación SEPA se ha cobrado correctamente y tu afiliación vuelve a estar activa. Gracias por regularizarlo.\n\n— Razón Común`;
  const html = envoltorio(
    'Al día',
    'Todo en orden',
    `<p style="margin:0;font-size:15px;line-height:1.7;color:#232A3B;">Tu domiciliación SEPA se ha cobrado correctamente y tu afiliación vuelve a estar activa. Gracias por regularizarlo.</p>`,
  );
  return { asunto, html, texto };
}

/** Encuesta de baja de una pregunta (vision-plataforma.md, Pilar 2 punto 4). */
export function correoBaja(opts: { nombre: string | null; urlEncuesta: string }) {
  const nombre = opts.nombre?.trim() || 'afiliado/a';
  const asunto = 'Antes de irte, una pregunta (30 segundos)';
  const texto = `Hola ${nombre},\n\nSentimos que te vayas. Si tienes 30 segundos, cuéntanos por qué en una sola pregunta: ${opts.urlEncuesta}\n\nEs el dato que más nos ayuda a mejorar. Y si algún día cambias de opinión, la puerta sigue abierta.\n\n— Razón Común`;
  const html = envoltorio(
    'Antes de irte',
    'Una pregunta de 30 segundos',
    `<p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#232A3B;">Sentimos que te vayas. Si tienes 30 segundos, cuéntanos por qué en una sola pregunta:</p>
    <table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#1B3D9C" style="border-radius:10px;">
      <a href="${opts.urlEncuesta}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#FFFFFF;">Responder (30 segundos)</a>
    </td></tr></table>
    <p style="margin:24px 0 0;font-size:13px;color:#5A6780;">Es el dato que más nos ayuda a mejorar. Y si algún día cambias de opinión, la puerta sigue abierta.</p>`,
  );
  return { asunto, html, texto };
}
