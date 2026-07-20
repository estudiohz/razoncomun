# Migración de afiliados actuales: tarjeta → domiciliación SEPA

> Contexto: antes de esta ola, los afiliados que ya pagaban lo hacían con tarjeta vía un
> **payment link** de Stripe (fuera de esta app). La decisión de producto (ver cabecera de
> `docs/tecnico/afiliados-y-transparencia.md`) es que la cuota se cobre por **domiciliación
> bancaria SEPA** — sin tarjetas que caducan, comisión más baja, especialmente en la cuota
> anual. Este documento es el procedimiento para invitar a esos afiliados a firmar el mandato
> SEPA sin interrumpir su afiliación ni duplicar cobros.

## Por qué no se migra "en caliente" desde el código

No hay forma de convertir una suscripción con tarjeta en una suscripción SEPA sin que el
afiliado vuelva a autorizar el cobro: el mandato SEPA es un consentimiento bancario nuevo,
legalmente distinto de una tarjeta guardada. Stripe no permite "cambiar el método de una
suscripción existente" de tarjeta a SEPA sin pasar por el Customer Portal (o un nuevo
Checkout) — es el propio banco quien debe validar el mandato, no Stripe ni nosotros.

## Procedimiento recomendado

1. **Inventario.** Exportar desde el dashboard de Stripe (o `stripe.subscriptions.list({ payment_method_types wildcard })`
   filtrando manualmente por `default_payment_method.type === 'card'`) la lista de
   suscripciones activas creadas por el payment link antiguo. Cruzar `customer.email` con
   `profiles.email` para saber a qué usuario de la webapp corresponde cada una (puede haber
   emails de Stripe sin cuenta en la webapp todavía — para esos, priorizar el paso 5).

2. **Activar el Customer Portal con `sepa_debit`.** En el dashboard de Stripe → Settings →
   Billing → Customer Portal, permitir "Update payment method" y asegurarse de que
   `sepa_debit` está entre los métodos ofrecidos ahí (mismo flag de cuenta que ya usa
   `/afiliate`, ver `lib/stripe/config.ts` → `metodosPagoCheckout()`).

3. **Campaña de invitación (una tanda, no goteo).** Email a los afiliados con tarjeta
   (plantilla nueva, mismo estilo que `lib/email/plantillas.ts`, tono de marca — no reutilizar
   `correoBienvenida` porque el mensaje es distinto): explica el cambio, por qué es mejor para
   el afiliado (menos caducidades, más recursos para el partido por la comisión menor), y un
   botón que abre una **Customer Portal session** (`stripe.billingPortal.sessions.create({ customer, return_url })`)
   donde puede añadir su IBAN como nuevo método de pago y marcarlo por defecto.
   - Dar una fecha límite razonable (p. ej. 30 días) antes de que la tarjeta deje de
     usarse como fallback.
   - El webhook ya existente (`customer.subscription.updated`) captura el cambio de
     `default_payment_method` sin tocar nada más: en cuanto el afiliado completa el Portal,
     `members.payment_method` y `members.sepa_mandate_id` se actualizan solos en el próximo
     evento (misma lógica que la alta nueva, ver `mandatoSepaMasReciente()` en
     `app/api/stripe/webhook/route.ts`).

4. **No canceles ni recrees la suscripción.** Es tentador cancelar la suscripción de tarjeta y
   crear una nueva por SEPA — no lo hagas: se pierde el histórico de `started_at` (afecta a la
   regla antigaming de 3 meses) y se generan dos eventos de alta/baja innecesarios en
   `audit_log`. El cambio de método de pago dentro de la MISMA suscripción es siempre
   preferible.

5. **Afiliados sin cuenta en la webapp.** Si el email de Stripe no cruza con ningún
   `profiles.email`, ese afiliado pagó con tarjeta antes de que existiera esta plataforma:
   invítalo primero a crear cuenta (mismo email) y luego sigue el paso 3 — el webhook necesita
   `metadata.user_id` en la Subscription para poder espejarla en `members` (ver comentario en
   `espejarSuscripcion()`). Mientras tanto, esa suscripción sigue cobrando con tarjeta en
   Stripe sin aparecer en `members` — no rompe nada, simplemente no cuenta para el censo de
   votaciones hasta que se vincule.

6. **Verificación de cierre.** Pasada la fecha límite, listar en Stripe cuántas suscripciones
   siguen con `default_payment_method.type === 'card'`. Decisión de Sergio: si quedan pocas,
   contacto manual uno a uno; si quedan muchas, plantear una segunda tanda con recordatorio.

## Qué NO hacer

- No hay endpoint en esta app para "forzar" el cambio de método de pago de otro usuario desde
  el panel admin — es una decisión deliberada (el mandato SEPA lo debe autorizar el propio
  titular de la cuenta bancaria, nunca un tercero en su nombre).
- No hacer esta migración en modo test primero contra producción: probarla completa contra la
  cuenta de test de Stripe con un cliente/tarjeta de prueba antes de enviar el primer email
  real.

## Pendiente de Sergio antes de lanzar la campaña

- Confirmar que `sepa_debit` sigue activo en la cuenta de Stripe **en modo LIVE** (en test ya
  está verificado, ver informe de cierre de esta ola).
- Redactar/aprobar el texto exacto del email de invitación (tono de marca).
- Decidir la fecha límite de la campaña.
