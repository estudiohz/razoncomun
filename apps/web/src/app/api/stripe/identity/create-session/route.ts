import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
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

  const stripe = new Stripe(secretKey);

  const session = await stripe.identity.verificationSessions.create({
    type: 'document',
    metadata: { user_id: user.id },
    options: { document: { require_matching_selfie: true } },
    return_url: `${urlSitio()}/perfil?identidad=pendiente`,
  });

  return NextResponse.json({ url: session.url });
}
