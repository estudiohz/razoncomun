"""INVARIANTE: NIF con formato invalido rechazado; tax_identities no legible por otros.

El formato lo impone un CHECK de BD (tax_id ~ '^[0-9XYZ][0-9]{7}[A-Z]$'), asi que
se verifica por estado persistido: un NIF mal formado NO debe crear fila; uno bien
formado SI (control positivo). Usa el fixture member_new (sin NIF previo).
"""

INVALIDOS = ["INVALIDO", "1234567Z", "123456789", "1234567AZ", "Z1234567", ""]
VALIDO = "87654321X"


def run(http, rep, fx):
    rep.block("NIF: formato y aislamiento (tax_identities)")
    uid = fx.users["member_new"]
    tok = fx.token("member_new")

    # asegurar punto de partida limpio
    http.sql("delete from tax_identities where user_id='%s'" % uid)

    for bad in INVALIDOS:
        http.rest("POST", "tax_identities", tok,
                  {"user_id": uid, "tax_id": bad, "verified_method": "declared"})
        n = int(http.sql_val("select count(*) from tax_identities where user_id='%s'" % uid) or 0)
        rep.expect(n == 0, "NIF invalido rechazado: %r" % (bad or "(vacio)"), "filas=%d" % n)
        if n:  # si se colo, limpiar antes de seguir
            http.sql("delete from tax_identities where user_id='%s'" % uid)

    # control positivo: un NIF valido SI se acepta
    st, body = http.rest("POST", "tax_identities", tok,
                         {"user_id": uid, "tax_id": VALIDO, "verified_method": "declared"})
    n = int(http.sql_val("select count(*) from tax_identities where user_id='%s' and tax_id='%s'"
                         % (uid, VALIDO)) or 0)
    rep.expect(n == 1, "[control+] NIF valido %s aceptado" % VALIDO, "HTTP %s filas=%d" % (st, n))

    # aislamiento: otro usuario no lee este NIF
    st, data = http.rest_json("GET", "tax_identities?user_id=eq.%s&select=tax_id" % uid,
                              fx.token("other"))
    leak = isinstance(data, list) and any(r.get("tax_id") for r in data)
    rep.expect(not leak, "otro usuario NO lee el NIF ajeno", "HTTP %s filas=%s"
               % (st, len(data) if isinstance(data, list) else data))

    # limpieza local (teardown tambien lo hace)
    http.sql("delete from tax_identities where user_id='%s'" % uid)
