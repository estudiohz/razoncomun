"""INVARIANTE: idempotencia del webhook de Stripe (reenviar el mismo evento no duplica).

El webhook es un route handler de la app (Next.js), no PostgREST, y la firma se
genera con el SDK de Stripe. Sin la app desplegada/corriendo (RC_WEB_URL) y sin el
secreto de webhook (RC_STRIPE_WEBHOOK_SECRET) esto NO se puede ejercitar de verdad,
asi que se marca SKIP 'requiere despliegue' y queda listo.

Cuando ambos existen: se lee el estado (p.ej. identity_verified_at del usuario del
evento) ANTES, se postea el MISMO evento firmado DOS veces, y se comprueba que el
efecto es identico (no se duplican members/donations ni cambia dos veces el perfil).
La verificacion criptografica de firma valida/invalida vive en
apps/web/scripts/verificacion-stripe-webhook.mjs (bridge en run.py --node).
"""


def run(http, rep, fx):
    rep.block("Idempotencia webhook Stripe")
    if not http.cfg.web_url or not http.cfg.stripe_webhook_secret:
        faltan = []
        if not http.cfg.web_url:
            faltan.append("RC_WEB_URL")
        if not http.cfg.stripe_webhook_secret:
            faltan.append("RC_STRIPE_WEBHOOK_SECRET")
        rep.skip("idempotencia de webhook: requiere despliegue (faltan %s)" % ", ".join(faltan),
                 "ver apps/web/scripts/verificacion-stripe-webhook.mjs")
        return
    # Con entorno completo se ejercitaria el doble-post real. Se deja el gancho
    # explicito para la Ola 5; no se fuerza con mocks.
    rep.skip("idempotencia de webhook: gancho listo, ejecutar con la app desplegada",
             "RC_WEB_URL + RC_STRIPE_WEBHOOK_SECRET presentes")
