import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { guardarEvento, leerEvento, tokenWebhookValido } from '@/lib/newsletter/brevo';

/**
 * Webhook transaccional de Brevo (N2). Se da de alta en Brevo →
 * Transactional → Settings → Webhooks con la URL que da el panel
 * /admin/newsletter (lleva `?k=`). Brevo manda un evento por petición, o un
 * array si se agrupan.
 */
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!tokenWebhookValido(new URL(req.url).searchParams.get('k'))) {
    return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  }
  let cuerpo: unknown;
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON no válido' }, { status: 400 });
  }
  const admin = createAdminClient();
  let guardados = 0;
  for (const item of Array.isArray(cuerpo) ? cuerpo : [cuerpo]) {
    const ev = leerEvento(item);
    if (ev && (await guardarEvento(admin, ev, item))) guardados++;
  }
  // Siempre 200 con un cuerpo válido: si Brevo recibe error, reintenta y desactiva el webhook.
  return NextResponse.json({ ok: true, guardados });
}
