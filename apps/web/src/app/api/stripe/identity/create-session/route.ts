import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { urlSitio } from '@/lib/supabase/env';

/**
 * Crea una sesión de Stripe Identity para subir al nivel `verified`
 * (docs/tecnico/autenticacion-y-niveles.md). Nosotros NUNCA vemos el
 * documento ni el selfie: Stripe aloja el flujo completo y solo nos
 * notifica el veredicto por webhook (ver /api/stripe/identity/webhook).
 */
export async function POST() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json(
      {
        error:
          'Stripe Identity no está configurado todavía (falta STRIPE_SECRET_KEY). Ver AUTH-SETUP.md.',
      },
      { status: 501 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  // Solo un socio con cuota activa puede verificarse: la comprobación se hace
  // en BD (nunca por el botón oculto ni por el claim del JWT) para que una
  // llamada directa a esta ruta no salte el requisito.
  const { data: esSocio } = await supabase.rpc('is_active_member', { p_user: user.id });
  if (!esSocio) {
    return NextResponse.json(
      { error: 'Para verificar tu identidad necesitas una cuota de socio activa.' },
      { status: 403 },
    );
  }

  const stripe = new Stripe(secretKey);

  const session = await stripe.identity.verificationSessions.create({
    type: 'document',
    metadata: { user_id: user.id },
    options: { document: { require_matching_selfie: true } },
    return_url: `${urlSitio()}/panel/perfil?identidad=pendiente#verificacion`,
  });

  // Marca "en revisión" para /panel/perfil. Un fallo aquí no debe impedir
  // que la persona verifique: solo se pierde el aviso.
  await createAdminClient()
    .from('audit_log')
    .insert({
      actor_id: user.id,
      action: 'stripe_identity_session_creada',
      entity: 'stripe_identity_event',
      entity_id: null,
      meta: { session_id: session.id, user_id: user.id },
    });

  return NextResponse.json({ url: session.url });
}
