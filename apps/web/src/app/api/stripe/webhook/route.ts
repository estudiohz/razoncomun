import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { stripeCliente, stripeSecretKey, stripeWebhookSecret } from '@/lib/stripe/config';
import { yaProcesado, registrarEvento } from '@/lib/stripe/eventos';
import { enviarCorreo } from '@/lib/email/enviar';
import { correoBienvenida, correoImpago, correoRecuperado, correoBaja } from '@/lib/email/plantillas';

/**
 * Webhook principal de afiliación (rc-07). Reglas (I7, revision-seguridad.md
 * — mismo patrón que /api/stripe/identity/webhook de rc-03):
 * 1. Firma verificada SIEMPRE antes de mirar el body.
 * 2. Idempotencia vía `audit_log` (Stripe puede — y en producción, hará —
 *    reenviar el mismo evento).
 * 3. Espejo en `members` con `service_role` (única escritura permitida por
 *    RLS, 0003_identity.sql) y recálculo de `profiles.level`.
 * 4. `profiles.level` es SOLO UX/claim (C2): la autoridad real para votar es
 *    `members.status` comprobado en el momento del INSERT por las RLS de
 *    `ballots`. Por eso aquí lo tratamos con normalidad, sin urgencia de
 *    propagación instantánea al JWT.
 *
 * Eventos manejados: customer.subscription.created/updated/deleted,
 * invoice.paid, invoice.payment_failed. `checkout.session.completed` NO se
 * procesa aparte: al crear el Checkout Session pasamos
 * `subscription_data.metadata.user_id`, así que ese metadata ya viaja en el
 * propio objeto Subscription de customer.subscription.created — una fuente
 * de verdad, no dos.
 */
export async function POST(request: Request) {
  let webhookSecret: string;
  try {
    stripeSecretKey();
    webhookSecret = stripeWebhookSecret();
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 501 });
  }

  const stripe = stripeCliente();
  const payload = await request.text();
  const signature = request.headers.get('stripe-signature');

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature ?? '', webhookSecret);
  } catch (err) {
    return NextResponse.json({ error: `Firma inválida: ${(err as Error).message}` }, { status: 400 });
  }

  const admin = createAdminClient();

  if (await yaProcesado(admin, event.id)) {
    return NextResponse.json({ ok: true, idempotente: true });
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const resultado = await espejarSuscripcion(admin, stripe, sub);

      if (resultado?.enviarBienvenida && resultado.userId) {
        const { data: perfil } = await admin
          .from('profiles')
          .select('display_name, email')
          .eq('id', resultado.userId)
          .single();
        if (perfil?.email) {
          const plantilla = correoBienvenida({
            nombre: perfil.display_name,
            periodo: resultado.billingPeriod ?? 'monthly',
            amountCents: resultado.amountCents ?? 0,
          });
          await enviarCorreo({ para: perfil.email, ...plantilla });
        }
      }

      await registrarEvento(admin, {
        eventId: event.id,
        tipo: event.type,
        action: `stripe_subscription_${event.type.split('.').pop()}`,
        userId: resultado?.userId ?? null,
        meta: { subscription_id: sub.id, status: sub.status, member_status: resultado?.status ?? null },
      });
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const { data: miembro } = await admin
        .from('members')
        .select('id, user_id')
        .eq('stripe_subscription_id', sub.id)
        .maybeSingle();

      if (miembro) {
        await admin
          .from('members')
          .update({ status: 'canceled', canceled_at: new Date().toISOString() })
          .eq('id', miembro.id);

        const { data: perfil } = await admin
          .from('profiles')
          .select('level, display_name, email')
          .eq('id', miembro.user_id)
          .single();

        // Baja de nivel automática (docs/tecnico/afiliados-y-transparencia.md):
        // solo degradamos 'member'. 'verified' se conserva — ya pasó por
        // Stripe Identity y volver a pedirlo si reactiva la cuota sería
        // fricción injustificada; el DERECHO A VOTO real lo decide siempre
        // members.status, no este claim (C2).
        if (perfil?.level === 'member') {
          await admin.from('profiles').update({ level: 'registered' }).eq('id', miembro.user_id);
        }

        if (perfil?.email) {
          const urlEncuesta = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.razoncomun.com'}/afiliate/encuesta-baja`;
          const plantilla = correoBaja({ nombre: perfil.display_name, urlEncuesta });
          await enviarCorreo({ para: perfil.email, ...plantilla });
        }
      }

      await registrarEvento(admin, {
        eventId: event.id,
        tipo: event.type,
        action: 'stripe_subscription_deleted',
        userId: miembro?.user_id ?? null,
        meta: { subscription_id: sub.id },
      });
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = idSuscripcionDeInvoice(invoice);
      let userId: string | null = null;

      if (subId) {
        const { data: miembro } = await admin
          .from('members')
          .select('id, user_id, status, sepa_mandate_id, stripe_customer_id')
          .eq('stripe_subscription_id', subId)
          .maybeSingle();

        if (miembro) {
          userId = miembro.user_id;
          const seRecupera = miembro.status !== 'active';
          const patch: Record<string, unknown> = {};
          if (seRecupera) patch.status = 'active';
          // Red de seguridad: si al procesar customer.subscription.created el
          // cargo aún no existía, aquí (con la factura ya pagada) el cargo
          // seguro que existe — reintentamos rellenar sepa_mandate_id.
          if (!miembro.sepa_mandate_id && miembro.stripe_customer_id) {
            const mandato = await mandatoSepaMasReciente(stripe, miembro.stripe_customer_id);
            if (mandato) patch.sepa_mandate_id = mandato;
          }
          if (Object.keys(patch).length) {
            await admin.from('members').update(patch).eq('id', miembro.id);
          }
          if (seRecupera) {
            const { data: perfil } = await admin
              .from('profiles')
              .select('display_name, email')
              .eq('id', miembro.user_id)
              .single();
            if (perfil?.email) {
              const plantilla = correoRecuperado({ nombre: perfil.display_name });
              await enviarCorreo({ para: perfil.email, ...plantilla });
            }
          }
        }
      }

      await registrarEvento(admin, {
        eventId: event.id,
        tipo: event.type,
        action: 'stripe_invoice_paid',
        userId,
        meta: { invoice_id: invoice.id, subscription_id: subId, amount_paid: invoice.amount_paid },
      });
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = idSuscripcionDeInvoice(invoice);
      let userId: string | null = null;

      if (subId) {
        const { data: miembro } = await admin
          .from('members')
          .select('id, user_id')
          .eq('stripe_subscription_id', subId)
          .maybeSingle();

        if (miembro) {
          userId = miembro.user_id;
          await admin.from('members').update({ status: 'past_due' }).eq('id', miembro.id);

          const { data: perfil } = await admin
            .from('profiles')
            .select('display_name, email')
            .eq('id', miembro.user_id)
            .single();
          if (perfil?.email) {
            const plantilla = correoImpago({
              nombre: perfil.display_name,
              intento: invoice.attempt_count ?? 1,
              amountCents: invoice.amount_due,
            });
            await enviarCorreo({ para: perfil.email, ...plantilla });
          }
        }
      }

      await registrarEvento(admin, {
        eventId: event.id,
        tipo: event.type,
        action: 'stripe_invoice_payment_failed',
        userId,
        meta: { invoice_id: invoice.id, subscription_id: subId, attempt_count: invoice.attempt_count },
      });
      break;
    }

    default: {
      // Tipo no relevante: se ignora sin error (Stripe espera 200 para no
      // reintentar indefinidamente), pero queda registrado para conciliación.
      await registrarEvento(admin, {
        eventId: event.id,
        tipo: event.type,
        action: 'stripe_subscription_evento_ignorado',
      });
    }
  }

  return NextResponse.json({ ok: true });
}

function idDe(valor: string | { id: string } | null | undefined): string | null {
  if (!valor) return null;
  return typeof valor === 'string' ? valor : valor.id;
}

/**
 * Extrae el id de la Subscription de una Invoice.
 *
 * ⚠️ Compatibilidad de versión de API: `Invoice.subscription` (el campo
 * clásico) NO existe en la forma de tipos de esta cuenta/versión de Stripe
 * (2026-01-28.clover, verificado contra la API real, ver informe) — el dato
 * vive ahora en `invoice.parent.subscription_details.subscription`. Un
 * primer intento de este código usaba `invoice.subscription` directamente y
 * el build fallaba en tipos (`error TS2339`); esta función es el único sitio
 * que sabe dónde está el campo, así el resto del webhook no depende de la
 * forma exacta del objeto Invoice.
 */
function idSuscripcionDeInvoice(invoice: Stripe.Invoice): string | null {
  const detalle = invoice.parent?.subscription_details;
  return idDe(detalle?.subscription as never);
}

/**
 * Referencia del mandato SEPA del cargo más reciente de un customer.
 *
 * El mandato NO vive en el PaymentMethod (`sepa_debit.mandate` no es un
 * campo de ese recurso pese a lo que sugeriría el naming) sino en
 * `charge.payment_method_details.sepa_debit.mandate` — verificado contra la
 * API real de Stripe (test), no documentación. `charges.list` con
 * `customer` devuelve los cargos ordenados por creación descendente, así
 * que el primer resultado sepa_debit con mandato es el mandato vigente.
 */
async function mandatoSepaMasReciente(stripe: Stripe, customerId: string | null): Promise<string | null> {
  if (!customerId) return null;
  try {
    const cargos = await stripe.charges.list({ customer: customerId, limit: 5 });
    for (const cargo of cargos.data) {
      const mandato = cargo.payment_method_details?.sepa_debit?.mandate;
      if (mandato) return typeof mandato === 'string' ? mandato : null;
    }
  } catch {
    // best-effort: si falla, el próximo evento (subscription.updated,
    // próxima factura) reintenta — nunca bloqueamos el espejo por esto.
  }
  return null;
}

function mapearEstado(estado: Stripe.Subscription.Status): 'active' | 'past_due' | 'canceled' {
  switch (estado) {
    case 'active':
    case 'trialing':
      return 'active';
    case 'past_due':
    case 'unpaid':
    case 'incomplete':
      return 'past_due';
    case 'canceled':
    case 'incomplete_expired':
    case 'paused':
    default:
      return 'canceled';
  }
}

/**
 * Espeja una Subscription de Stripe en `members` y recalcula
 * `profiles.level`/`member_since`. Devuelve datos suficientes para decidir
 * si toca enviar el correo de bienvenida (solo la PRIMERA vez que
 * `member_since` pasa de NULL a tener valor — evita reenviar "bienvenido/a"
 * en cada actualización de la suscripción).
 */
async function espejarSuscripcion(
  admin: ReturnType<typeof createAdminClient>,
  stripe: Stripe,
  sub: Stripe.Subscription,
) {
  const userId = sub.metadata?.user_id ?? null;
  if (!userId) {
    console.warn(`[stripe-webhook] Subscription ${sub.id} sin metadata.user_id — no se puede mapear a members.`);
    return null;
  }

  const price = sub.items.data[0]?.price;
  const billingPeriod: 'monthly' | 'annual' = price?.recurring?.interval === 'year' ? 'annual' : 'monthly';
  const amountCents = price?.unit_amount ?? null;
  const status = mapearEstado(sub.status);
  const startedAt = sub.start_date ? new Date(sub.start_date * 1000).toISOString() : null;
  const canceledAt = sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null;

  // Método de pago real + referencia del mandato SEPA.
  //
  // ⚠️ Verificado empíricamente en test (20/07/2026, ver informe): el objeto
  // PaymentMethod de Stripe NUNCA lleva `sepa_debit.mandate` — ese campo NO
  // existe en el recurso PaymentMethod. La referencia real del mandato solo
  // aparece en `charge.payment_method_details.sepa_debit.mandate` (la
  // primera versión de este código consultaba PaymentMethod y por tanto
  // `sepa_mandate_id` quedaba SIEMPRE null — bug corregido aquí). Se busca el
  // cargo más reciente del customer: en el momento de
  // customer.subscription.created ya existe el Charge (aunque esté en
  // `pending`, que es el estado típico de SEPA hasta liquidar) porque el
  // mandato se fija en la confirmación del PaymentIntent, no en la
  // liquidación final — el propio invoice.paid vuelve a intentarlo como red
  // de seguridad si en `created` aún no hubiera cargo.
  let paymentMethod = 'sepa_debit';
  let sepaMandateId: string | null = null;
  const pmId = idDe(sub.default_payment_method as never);
  if (pmId) {
    try {
      const pm = await stripe.paymentMethods.retrieve(pmId);
      paymentMethod = pm.type;
    } catch {
      // No bloqueamos el espejo por esto — se reintentará en el próximo evento.
    }
  }
  if (sub.customer) {
    sepaMandateId = await mandatoSepaMasReciente(stripe, idDe(sub.customer as never));
  }

  const { data: existente } = await admin
    .from('members')
    .select('id, started_at')
    .eq('stripe_subscription_id', sub.id)
    .maybeSingle();

  const payload = {
    user_id: userId,
    stripe_customer_id: idDe(sub.customer),
    stripe_subscription_id: sub.id,
    status,
    billing_period: billingPeriod,
    amount_cents: amountCents,
    payment_method: paymentMethod,
    sepa_mandate_id: sepaMandateId,
    // El "ancla" started_at nunca se pisa una vez fijada (regla antigaming 3 meses, C2).
    started_at: existente?.started_at ?? startedAt,
    canceled_at: canceledAt,
  };

  if (existente) {
    await admin.from('members').update(payload).eq('id', existente.id);
  } else {
    await admin.from('members').insert(payload);
  }

  let enviarBienvenida = false;
  const { data: perfil } = await admin.from('profiles').select('level, member_since').eq('id', userId).single();

  if (status === 'active') {
    const patch: Record<string, unknown> = {};
    if (perfil && perfil.level === 'registered') patch.level = 'member';
    if (perfil && !perfil.member_since) {
      patch.member_since = payload.started_at ?? new Date().toISOString();
      enviarBienvenida = true;
    }
    if (Object.keys(patch).length) await admin.from('profiles').update(patch).eq('id', userId);
  }

  return { userId, status, billingPeriod, amountCents, enviarBienvenida };
}
