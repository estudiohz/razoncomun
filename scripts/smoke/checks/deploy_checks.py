"""Invariantes que dependen de la APP DESPLEGADA (Next.js corriendo / Ollama).

No se fuerzan con mocks: si RC_WEB_URL no esta, se marcan SKIP con el motivo y la
referencia al verificador existente que los cubre cuando haya despliegue. Cuando
RC_WEB_URL esta definido se ejecutan los HTTP que se puedan (cabeceras de
seguridad, noindex de rutas privadas). El bridge a los verificadores Node
(e2e, mfa, provider-revert, gate-brain) lo dispara run.py --node.
"""

# (invariante, motivo del SKIP, verificador de referencia)
REQUIRE_DEPLOY = [
    ("2FA obligatorio en /admin", "requiere sesion admin + app",
     "apps/web/scripts/verificacion-mfa.mjs"),
    ("Webhook sin firma valida -> rechazado", "requiere route handler + secreto",
     "apps/web/scripts/verificacion-stripe-webhook.mjs"),
    ("Prompt injection a /chat y a Opina (5 variantes)", "requiere Ollama (embeddings) + app",
     "scripts/gate-brain.mjs"),
    ("Ajustes de IA: revert de proveedor / credenciales", "requiere app + Ollama",
     "scripts/verify-provider-revert.mjs, apps/web/scripts/verificacion-ajustes-ia.mjs"),
    ("Flujo e2e (registro/login/afiliacion)", "requiere app corriendo",
     "apps/web/scripts/verificacion-e2e.mjs"),
    ("SEO: titulo/descripcion/OG unicos + sitemap + noindex privadas", "requiere HTML renderizado",
     "(Lighthouse manual; rutas servidas por la app)"),
    ("Accesibilidad: teclado, contraste AA, foco, labels", "requiere DOM renderizado",
     "(axe/Lighthouse sobre la app desplegada)"),
]

SEC_HEADERS = ["content-security-policy", "strict-transport-security", "x-frame-options"]


def run(http, rep, fx=None):
    rep.block("Invariantes dependientes de despliegue")

    if not http.cfg.web_url:
        for inv, motivo, ref in REQUIRE_DEPLOY:
            rep.skip("%s: %s" % (inv, motivo), ref)
        rep.skip("Cabeceras de seguridad (CSP/HSTS/X-Frame-Options): requiere RC_WEB_URL", "")
        return

    # Con RC_WEB_URL: lo que si se puede medir por HTTP directo.
    r = http.web("/")
    if r and r[0] not in (-1,):
        st, headers, _ = r
        lower = {k.lower(): v for k, v in headers.items()}
        for h in SEC_HEADERS:
            rep.expect(h in lower, "cabecera de seguridad presente: %s" % h,
                       "HTTP %s valor=%s" % (st, lower.get(h, "AUSENTE")))
    else:
        rep.skip("home no responde en RC_WEB_URL", "resp=%s" % (r[0] if r else "sin conexion"))

    # rutas privadas deben llevar noindex
    for ruta in ["/perfil", "/admin"]:
        r = http.web(ruta)
        if r and r[0] not in (-1,):
            st, headers, body = r
            robots = {k.lower(): v for k, v in headers.items()}.get("x-robots-tag", "")
            noindex = "noindex" in robots.lower() or "noindex" in body.lower()
            rep.expect(noindex, "ruta privada %s marcada noindex" % ruta,
                       "HTTP %s x-robots-tag=%s" % (st, robots or "(en meta?)"))
        else:
            rep.skip("%s no evaluable" % ruta, "")

    # el resto sigue necesitando el bridge Node / herramientas externas
    for inv, motivo, ref in REQUIRE_DEPLOY:
        rep.skip("%s: usar verificador dedicado" % inv, ref)
