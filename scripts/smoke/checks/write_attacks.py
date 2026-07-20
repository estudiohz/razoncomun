"""INVARIANTES de ESCRITURA, verificados por ESTADO PERSISTIDO, no por codigo HTTP.

Para cada ataque: se lee el valor con service_role ANTES, se lanza el intento con
el JWT del atacante saltandose la UI, y se relee DESPUES. El invariante PASA si el
valor NO cambio (o si el ballot ilegitimo no se persistio), sea cual sea el status
que devuelva PostgREST. "La RLS/el trigger bloquea" se demuestra con el dato intacto.

Incluye un control POSITIVO (member antiguo+verificado SI puede votar): si todo
fuera deny-all la suite estaria mintiendo en verde.
"""


def _unchanged(http, rep, title, value_sql, attack):
    before = http.sql_val(value_sql)
    st, body = attack()
    after = http.sql_val(value_sql)
    ok = (before == after)
    rep.expect(ok, title, "HTTP %s | antes=%r despues=%r" % (st, before, after))
    return ok


def run(http, rep, fx):
    anon = http.cfg.anon_key
    U = fx.users
    vid = fx.vote_id

    # ================= C-1: columnas gobernadas por el webhook =================
    rep.block("C-1  perfil no auto-elevable (identity_verified_at / member_since / level)")
    mu = U["member_old_unverified"]
    tok_mu = fx.token("member_old_unverified")
    _unchanged(http, rep,
               "member no verificado NO puede escribir identity_verified_at (C-1)",
               "select identity_verified_at is not null from profiles where id='%s'" % mu,
               lambda: http.rest("PATCH", "profiles?id=eq.%s" % mu, tok_mu,
                                 {"identity_verified_at": "2026-01-01T00:00:00Z"}))
    _unchanged(http, rep,
               "member NO puede antedatar member_since",
               "select member_since from profiles where id='%s'" % mu,
               lambda: http.rest("PATCH", "profiles?id=eq.%s" % mu, tok_mu,
                                 {"member_since": "2019-01-01T00:00:00Z"}))
    reg = U["registered"]
    tok_reg = fx.token("registered")
    _unchanged(http, rep,
               "registered NO puede auto-elevarse a level=verified",
               "select level from profiles where id='%s'" % reg,
               lambda: http.rest("PATCH", "profiles?id=eq.%s" % reg, tok_reg,
                                 {"level": "verified"}))

    # D-017 end-to-end: tras el intento de bypass, sigue sin poder votar vinculante
    def _mu_binding_ballot():
        return http.rest("POST", "ballots", tok_mu,
                         {"vote_id": vid, "user_id": mu, "choice": "favor", "weight": 1})
    _mu_binding_ballot()
    n = int(http.sql_val("select count(*) from ballots where vote_id='%s' and user_id='%s'" % (vid, mu)) or 0)
    rep.expect(n == 0, "member no verificado NO emite voto vinculante (D-017)", "ballots persistidos=%d" % n)

    # ================= Escalada de privilegios =================
    rep.block("Escalada de privilegios")
    _unchanged(http, rep,
               "registered NO puede auto-concederse rol admin",
               "select count(*) from user_app_roles r join app_roles a on a.id=r.role_id "
               "where r.user_id='%s' and a.key='admin'" % reg,
               lambda: http.rest("POST", "user_app_roles", tok_reg,
                                 {"user_id": reg, "role_id": 1}))
    _unchanged(http, rep,
               "registered NO puede crearse un cargo (positions)",
               "select count(*) from positions where user_id='%s'" % reg,
               lambda: http.rest("POST", "positions", tok_reg,
                                 {"user_id": reg, "role": "president", "scope": "national"}))
    _unchanged(http, rep,
               "member cancelado NO puede reactivar su membresia",
               "select status from members where user_id='%s'" % U["member_canceled"],
               lambda: http.rest("PATCH", "members?user_id=eq.%s" % U["member_canceled"],
                                 fx.token("member_canceled"), {"status": "active"}))

    # ================= Sellado de reglas de votacion (I6) =================
    rep.block("Sellado de votacion abierta (quorum / threshold / min_membership_days)")
    tok_admin = fx.token("admin")
    for field, val in [("quorum", 999), ("threshold", 0.01), ("min_membership_days", 0)]:
        _unchanged(http, rep,
                   "admin NO puede cambiar %s con la votacion abierta" % field,
                   "select %s from votes where id='%s'" % (field, vid),
                   lambda f=field, v=val: http.rest("PATCH", "votes?id=eq.%s" % vid, tok_admin, {f: v}))

    # ================= settings globales =================
    rep.block("settings globales (min_membership_days)")
    _unchanged(http, rep,
               "registered NO puede cambiar settings.min_membership_days",
               "select value from settings where key='min_membership_days'",
               lambda: http.rest("PATCH", "settings?key=eq.min_membership_days", tok_reg, {"value": 0}))
    _unchanged(http, rep,
               "anon NO puede cambiar settings.min_membership_days",
               "select value from settings where key='min_membership_days'",
               lambda: http.rest("PATCH", "settings?key=eq.min_membership_days", anon, {"value": 0}))

    # ================= Elegibilidad de voto (matriz) =================
    rep.block("Elegibilidad de voto sobre manifiesto (censo: verified + antiguedad)")
    # negativos: nadie salvo el miembro antiguo verificado emite peso=1
    negativos = [
        ("anon", anon, "00000000-0000-4000-8000-0000deadbeef"),
        ("registered", tok_reg, reg),
        ("member_new", fx.token("member_new"), U["member_new"]),
        ("member_old_unverified", tok_mu, mu),
        ("member_canceled", fx.token("member_canceled"), U["member_canceled"]),
    ]
    for name, tok, uid in negativos:
        http.rest("POST", "ballots", tok, {"vote_id": vid, "user_id": uid, "choice": "favor", "weight": 1})
        n = int(http.sql_val("select count(*) from ballots where vote_id='%s' and user_id='%s'" % (vid, uid)) or 0)
        rep.expect(n == 0, "%s NO emite voto vinculante (peso=1)" % name, "persistidos=%d" % n)

    # CONTROL POSITIVO: member antiguo + verificado SI vota vinculante
    tok_ver = fx.token("member_old_verified")
    ver = U["member_old_verified"]
    http.rest("POST", "ballots", tok_ver, {"vote_id": vid, "user_id": ver, "choice": "favor", "weight": 1})
    n = int(http.sql_val("select count(*) from ballots where vote_id='%s' and user_id='%s'" % (vid, ver)) or 0)
    rep.expect(n == 1, "[control+] member antiguo verificado SI emite voto vinculante", "persistidos=%d" % n)

    # suplantacion y peso ilegitimo
    http.rest("POST", "ballots", tok_ver, {"vote_id": vid, "user_id": U["other"], "choice": "contra", "weight": 1})
    n = int(http.sql_val("select count(*) from ballots where vote_id='%s' and user_id='%s'" % (vid, U["other"])) or 0)
    rep.expect(n == 0, "verificado NO puede votar en nombre de otro (suplantacion)", "persistidos=%d" % n)

    before_w = http.sql_val("select count(*) from ballots where vote_id='%s' and weight>1" % vid)
    http.rest("POST", "ballots", tok_ver, {"vote_id": vid, "user_id": ver, "choice": "favor", "weight": 99})
    after_w = http.sql_val("select count(*) from ballots where vote_id='%s' and weight>1" % vid)
    rep.expect(before_w == after_w, "peso de voto >1 rechazado (solo 0 consultivo / 1 vinculante)",
               "weight>1 antes=%s despues=%s" % (before_w, after_w))

    # ================= tax_identities: verificacion documental sellada =================
    rep.block("tax_identities (verificacion documental + aislamiento)")
    # sembrar un NIF declarado propio del member (declared) para poder atacarlo
    http.rest("POST", "tax_identities", tok_mu,
              {"user_id": mu, "tax_id": "12345678Z", "verified_method": "declared"})
    _unchanged(http, rep,
               "usuario NO puede auto-marcar verified_method=stripe_identity",
               "select verified_method from tax_identities where user_id='%s'" % mu,
               lambda: http.rest("PATCH", "tax_identities?user_id=eq.%s" % mu, tok_mu,
                                 {"verified_method": "stripe_identity"}))
    # aislamiento: otro usuario no lee el NIF ajeno
    st, data = http.rest_json("GET", "tax_identities?user_id=eq.%s&select=tax_id" % mu, tok_reg)
    leak = isinstance(data, list) and any(r.get("tax_id") for r in data)
    rep.expect(not leak, "otro usuario NO lee el NIF ajeno (aislamiento tax_identities)",
               "HTTP %s filas=%s" % (st, len(data) if isinstance(data, list) else data))

    # ================= credenciales de IA: opacas incluso a admin =================
    rep.block("ai_provider_credentials (inaccesible incluso a admin)")
    st, data = http.rest_json("GET", "ai_provider_credentials?select=*", tok_admin)
    rows = len(data) if isinstance(data, list) else "no-lista"
    rep.expect((isinstance(data, list) and len(data) == 0) or st in (401, 403, 404),
               "admin NO lee ai_provider_credentials", "HTTP %s filas=%s" % (st, rows))
