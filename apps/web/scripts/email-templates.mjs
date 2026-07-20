#!/usr/bin/env node
/**
 * Plantillas de email transaccional de Razón Común (rc-03-auth).
 *
 * Genera los 5 HTML que GoTrue debe usar para signup/recovery/magic
 * link/email_change/invite, en español, con la identidad visual del
 * partido, y permite enviar un correo real de prueba vía el SMTP de Brevo
 * ya configurado (mismas credenciales que usa GoTrue) para verificar cómo
 * se ve de verdad en una bandeja de entrada.
 *
 * Uso:
 *   node scripts/email-templates.mjs generar        → escribe los .html
 *   node scripts/email-templates.mjs enviar <tipo> <destino>
 *       tipo: confirmation | recovery | magic_link | email_change | invite
 *
 * Variables de plantilla (sintaxis Go html/template, las rellena GoTrue):
 *   {{ .SiteURL }} {{ .Token }} {{ .TokenHash }} {{ .Email }} {{ .RedirectTo }}
 * El enlace de acción NO usa {{ .ConfirmationURL }} (eso apunta al propio
 * GoTrue, /auth/v1/verify) — apunta directo a nuestra app:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=X&next=%2Fperfil
 * (ver apps/web/src/app/auth/confirm/route.ts).
 */
import nodemailer from 'nodemailer';
import fs from 'node:fs';
import path from 'node:path';

// Carga apps/web/.env.local para el comando "enviar" SIN pasar credenciales
// en la línea de comandos. Parser mínimo, sin dependencias.
function cargarEnvLocal() {
  const ruta = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(ruta)) return;
  for (const linea of fs.readFileSync(ruta, 'utf8').split('\n')) {
    const m = linea.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
cargarEnvLocal();

// Logo blanco (transparente) alojado en Supabase Storage — bucket público
// `marca`, subido y verificado accesible por el orquestador. Constante única
// (deuda anotada en el informe de cierre de ola): esta URL es del entorno de
// DESARROLLO (dev-api.razoncomun.com). En el corte de la Ola 5 hay que subir
// el logo también al bucket de producción y cambiar SOLO esta constante.
const LOGO_BLANCO_URL = 'https://dev-api.razoncomun.com/storage/v1/object/public/marca/logo-rc-blanco.png';
const LOGO_ANCHO = 240; // px mostrados (imagen real 613x183, mitad aprox. para nitidez retina)
const LOGO_ALTO = 72;

// Paleta (docs/marca/identidad-visual.md). Texto SIEMPRE en tinta/gris oscuro
// -- el teal incumple AA para texto (2.73:1) y aquí solo se usa como banda
// decorativa de cabecera, nunca portador de texto.
const COLOR = {
  tinta: '#1B3D9C',
  gris: '#5A6780',
  grisOscuro: '#232A3B',
  linea: '#E2E9F5',
  fondoNube: '#F4F8FD',
  blanco: '#FFFFFF',
  bandaFallback: '#8B30D9', // morado — deliberado (ver identidad-visual.md), nunca "todo azul"
};

const TIPOS = {
  confirmation: {
    asunto: 'Confirma tu email en Razón Común',
    eyebrow: 'Bienvenido/a',
    titulo: 'Confirma tu email',
    intro:
      'Gracias por registrarte en Razón Común. Solo falta un paso: confirma que este email es tuyo para activar tu cuenta.',
    ctaTexto: 'Confirmar mi email',
    notaOtp: 'Si el botón no funciona, entra en la app y usa este código:',
    pie: 'Recibes este correo porque alguien (esperamos que tú) creó una cuenta con este email en razoncomun.com.',
  },
  recovery: {
    asunto: 'Recupera el acceso a tu cuenta',
    eyebrow: 'Sin problema',
    titulo: 'Restablece tu contraseña',
    intro:
      'Hemos recibido una solicitud para restablecer la contraseña de tu cuenta de Razón Común. Si no has sido tú, ignora este correo: tu contraseña actual seguirá funcionando.',
    ctaTexto: 'Elegir nueva contraseña',
    notaOtp: 'Si el botón no funciona, entra en la app y usa este código:',
    pie: 'Recibes este correo porque se solicitó restablecer la contraseña de esta cuenta en razoncomun.com.',
  },
  magic_link: {
    asunto: 'Tu enlace de acceso a Razón Común',
    eyebrow: 'Acceso directo',
    titulo: 'Entra con un clic',
    intro: 'Pediste entrar en Razón Común sin contraseña. Usa este enlace de un solo uso.',
    ctaTexto: 'Entrar ahora',
    notaOtp: 'Si el botón no funciona, entra en la app y usa este código:',
    pie: 'Recibes este correo porque se solicitó un enlace de acceso para esta cuenta en razoncomun.com.',
  },
  email_change: {
    asunto: 'Confirma tu nuevo email',
    eyebrow: 'Cambio de email',
    titulo: 'Confirma tu nuevo email',
    intro: 'Has pedido cambiar el email de tu cuenta de Razón Común. Confirma la dirección nueva para completar el cambio.',
    ctaTexto: 'Confirmar nuevo email',
    notaOtp: 'Si el botón no funciona, entra en la app y usa este código:',
    pie: 'Recibes este correo porque se solicitó un cambio de email para esta cuenta en razoncomun.com.',
  },
  invite: {
    asunto: 'Te han invitado a Razón Común',
    eyebrow: 'Invitación',
    titulo: 'Te han invitado a unirte',
    intro: 'Alguien del equipo de Razón Común te ha invitado a crear una cuenta. Acepta la invitación para activarla.',
    ctaTexto: 'Aceptar invitación',
    notaOtp: 'Si el botón no funciona, entra en la app y usa este código:',
    pie: 'Recibes este correo porque el equipo de Razón Común te invitó a razoncomun.com.',
  },
};

function html({ eyebrow, titulo, intro, ctaTexto, ctaUrl, notaOtp, otp, pie, preheader }) {
  return `<!doctype html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${titulo} — Razón Común</title>
<!--[if mso]>
<style>table {border-collapse collapse: collapse;} .fallback-font {font-family: Arial, sans-serif;}</style>
<![endif]-->
<style>
  body, table, td { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  body { margin:0; padding:0; width:100% !important; background:${COLOR.fondoNube}; }
  a { text-decoration: none; }
  @media (prefers-color-scheme: dark) {
    .rc-bg { background:#0B1220 !important; }
    .rc-card { background:#141B2E !important; border-color:#232A3B !important; }
    .rc-text { color:#E7ECF7 !important; }
    .rc-muted { color:#9AA6C3 !important; }
    .rc-otp { background:#0B1220 !important; color:#E7ECF7 !important; border-color:#2B3350 !important; }
  }
  @media screen and (max-width: 600px) {
    .rc-container { width: 100% !important; }
    .rc-px { padding-left:20px !important; padding-right:20px !important; }
  }
</style>
</head>
<body class="rc-bg" style="margin:0;padding:0;background:${COLOR.fondoNube};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="rc-bg" style="background:${COLOR.fondoNube};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="rc-container" style="width:600px;max-width:600px;">
          <!-- banda de marca con el logo blanco (fallback sólido morado; degradado del aro para clientes que lo soporten). El logo SOLO va sobre esta banda de color, nunca sobre blanco (es blanco con transparencia). -->
          <tr>
            <td align="center" bgcolor="${COLOR.bandaFallback}" style="background:${COLOR.bandaFallback};background-image:linear-gradient(120deg,#1B3D9C 0%,#8B30D9 28%,#C3369E 50%,#E8792F 72%,#16B8A0 100%);padding:26px 0;border-radius:14px 14px 0 0;">
              <img src="${LOGO_BLANCO_URL}" width="${LOGO_ANCHO}" height="${LOGO_ALTO}" alt="Razón Común" style="display:block;border:0;outline:none;color:#ffffff;font-family:Montserrat,'Segoe UI',Arial,Helvetica,sans-serif;font-size:20px;font-weight:700;">
            </td>
          </tr>
          <tr>
            <td class="rc-card rc-px" bgcolor="${COLOR.blanco}" style="background:${COLOR.blanco};border:1px solid ${COLOR.linea};border-top:none;border-radius:0 0 14px 14px;padding:36px 40px 32px;font-family:Montserrat,'Segoe UI',Arial,Helvetica,sans-serif;">
              <p class="rc-muted" style="margin:0 0 6px;font-size:12.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${COLOR.tinta};">${eyebrow}</p>
              <h1 class="rc-text" style="margin:0 0 16px;font-size:24px;line-height:1.25;font-weight:800;color:${COLOR.grisOscuro};">${titulo}</h1>
              <p class="rc-text" style="margin:0 0 24px;font-size:15px;line-height:1.6;color:${COLOR.grisOscuro};">${intro}</p>

              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td bgcolor="${COLOR.tinta}" style="border-radius:10px;">
                    <a href="${ctaUrl}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#FFFFFF;background:${COLOR.tinta};border-radius:10px;">${ctaTexto}</a>
                  </td>
                </tr>
              </table>

              <p class="rc-muted" style="margin:28px 0 8px;font-size:13px;color:${COLOR.gris};">${notaOtp}</p>
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td class="rc-otp" style="background:${COLOR.fondoNube};border:1px solid ${COLOR.linea};border-radius:8px;padding:10px 18px;font-family:'Courier New',monospace;font-size:22px;font-weight:700;letter-spacing:.35em;color:${COLOR.grisOscuro};">${otp}</td>
                </tr>
              </table>

              <p class="rc-muted" style="margin:28px 0 0;font-size:12px;line-height:1.6;color:${COLOR.gris};">Este enlace y este código caducan pasado un tiempo por seguridad. Si no esperabas este correo, puedes ignorarlo con tranquilidad.</p>
            </td>
          </tr>
          <tr>
            <td class="rc-px" style="padding:20px 40px 0;font-family:Montserrat,'Segoe UI',Arial,Helvetica,sans-serif;">
              <p class="rc-muted" style="margin:0 0 4px;font-size:12px;line-height:1.6;color:${COLOR.gris};">${pie}</p>
              <p class="rc-muted" style="margin:0;font-size:12px;color:${COLOR.gris};">Razón Común — partido político inscrito en el Registro del Ministerio del Interior.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function texto({ titulo, intro, ctaTexto, ctaUrl, otp, pie }) {
  return [
    `${titulo} — Razón Común`,
    '',
    intro,
    '',
    `${ctaTexto}: ${ctaUrl}`,
    '',
    `Código (si el enlace no funciona): ${otp}`,
    '',
    'Este enlace y este código caducan pasado un tiempo por seguridad. Si no esperabas este correo, ignóralo.',
    '',
    pie,
    'Razón Común — partido político inscrito en el Registro del Ministerio del Interior.',
  ].join('\n');
}

// Mapa tipo de plantilla → valor de `type` que espera supabase.auth.verifyOtp
// (EmailOtpType: signup|invite|magiclink|recovery|email_change). No coincide
// 1:1 con el nombre de la plantilla de GoTrue (p.ej. "confirmation" → "signup").
const TIPO_VERIFY_OTP = {
  confirmation: 'signup',
  recovery: 'recovery',
  magic_link: 'magiclink',
  email_change: 'email_change',
  invite: 'invite',
};

function renderGoTemplate(tipo) {
  const t = TIPOS[tipo];
  const ctaUrl = `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=${TIPO_VERIFY_OTP[tipo]}&next=%2Fperfil`;
  const preheader = t.intro.slice(0, 90);
  return {
    asunto: t.asunto,
    html: html({ ...t, ctaUrl, otp: '{{ .Token }}', preheader }),
    texto: texto({ ...t, ctaUrl, otp: '{{ .Token }}' }),
  };
}

function renderPrueba(tipo, { tokenHash, otp, email }) {
  const t = TIPOS[tipo];
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const ctaUrl = `${siteUrl}/auth/confirm?token_hash=${tokenHash}&type=${TIPO_VERIFY_OTP[tipo]}&next=%2Fperfil`;
  const preheader = t.intro.slice(0, 90);
  return {
    asunto: `[PRUEBA PLANTILLA] ${t.asunto}`,
    html: html({ ...t, ctaUrl, otp, preheader }),
    texto: texto({ ...t, ctaUrl, otp }),
  };
}

const comando = process.argv[2];

if (comando === 'generar') {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const dir = path.resolve(process.cwd(), 'src/lib/auth/email-templates/gotrue');
  fs.mkdirSync(dir, { recursive: true });
  for (const tipo of Object.keys(TIPOS)) {
    const { html: h } = renderGoTemplate(tipo);
    fs.writeFileSync(path.join(dir, `${tipo}.html`), h, 'utf8');
    console.log('Escrito', path.join(dir, `${tipo}.html`));
  }
} else if (comando === 'previsualizar') {
  // Escribe el HTML con valores de ejemplo reales (sin enviar nada) para
  // poder revisarlo visualmente. No requiere red ni credenciales SMTP.
  const fs = await import('node:fs');
  const path = await import('node:path');
  const dir = path.resolve(process.cwd(), 'src/lib/auth/email-templates/preview');
  fs.mkdirSync(dir, { recursive: true });
  for (const tipo of Object.keys(TIPOS)) {
    const { html: h } = renderPrueba(tipo, {
      tokenHash: 'abc123prueba_no_es_un_token_real',
      otp: '331653',
      email: 'estudiohorizontal@gmail.com',
    });
    fs.writeFileSync(path.join(dir, `${tipo}.html`), h, 'utf8');
    console.log('Escrito', path.join(dir, `${tipo}.html`));
  }
} else if (comando === 'enviar') {
  const tipo = process.argv[3];
  const destino = process.argv[4];
  if (!TIPOS[tipo] || !destino) {
    console.error('Uso: node scripts/email-templates.mjs enviar <tipo> <destino>');
    process.exit(1);
  }
  const { asunto, html: h, texto: txt } = renderPrueba(tipo, {
    tokenHash: 'abc123prueba_no_es_un_token_real',
    otp: '331653',
    email: destino,
  });

  const transporte = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  const info = await transporte.sendMail({
    from: `"${process.env.SMTP_SENDER_NAME || 'Razón Común'}" <${process.env.SMTP_ADMIN_EMAIL}>`,
    to: destino,
    subject: asunto,
    html: h,
    text: txt,
  });
  console.log('Enviado:', info.messageId, info.response);
} else {
  console.log('Uso: node scripts/email-templates.mjs [generar|enviar <tipo> <destino>]');
}
