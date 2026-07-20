"""INVARIANTE: aislamiento de LECTURA por nivel (matriz RLS via PostgREST).

Distingue "0 filas porque RLS bloquea" de "0 filas porque la tabla esta vacia"
usando el conteo real con service_role como linea base. Se afirma sobre celdas
clave (lo que debe estar prohibido); ademas imprime una matriz compacta anon vs
registered vs admin como evidencia para el informe.
"""
import json

# Tablas que un usuario anonimo NUNCA debe poder leer (contienen datos sensibles).
PRIVATE_FROM_ANON = [
    "brain_documents",          # incluye chunks internal del cerebro
    "ai_provider_credentials",  # secretos de proveedores de IA
    "tax_identities",           # NIF de afiliados
    "members",                  # stripe_customer_id / subscription
    "notifications",            # notificaciones personales
]


def _base_counts(http):
    rows = http.sql(
        "select c.relname t from pg_class c join pg_namespace n on n.oid=c.relnamespace "
        "where n.nspname='public' and c.relkind='r' order by c.relname")
    counts = {}
    for r in rows:
        t = r["t"]
        try:
            counts[t] = int(http.sql_val('select count(*) from public."%s"' % t) or 0)
        except Exception:  # noqa: BLE001
            counts[t] = -1
    return counts


def _rows_seen(http, table, token):
    st, data = http.rest_json("GET", "%s?select=*&limit=500" % table, token)
    if isinstance(data, list):
        return st, len(data)
    return st, None


def run(http, rep, fx):
    anon = http.cfg.anon_key
    tok_reg = fx.token("registered")
    tok_admin = fx.token("admin")
    base = _base_counts(http)

    rep.block("Aislamiento de lectura - anon no lee lo privado")
    for t in PRIVATE_FROM_ANON:
        if t not in base:
            rep.skip("%s: tabla no existe en este entorno" % t)
            continue
        st, seen = _rows_seen(http, t, anon)
        if base[t] == 0:
            rep.skip("%s: anon ve %s filas (tabla vacia, no concluyente)" % (t, seen),
                     "HTTP %s base=0" % st)
        else:
            rep.expect(seen == 0, "anon NO lee %s (%d filas reales ocultas)" % (t, base[t]),
                       "HTTP %s ve=%s" % (st, seen))

    rep.block("Aislamiento de lectura - profiles solo propio")
    # registered solo debe ver su propia fila
    st, data = http.rest_json("GET", "profiles?select=id&limit=500", tok_reg)
    ids = {r.get("id") for r in data} if isinstance(data, list) else set()
    rep.expect(isinstance(data, list) and ids <= {fx.users["registered"]},
               "registered solo lee su propio profile",
               "HTTP %s ve_ids=%d" % (st, len(ids)))
    # anon no debe ver ninguna fila de profiles
    st, seen = _rows_seen(http, "profiles", anon)
    rep.expect(seen == 0, "anon NO lee profiles ajenos", "HTTP %s ve=%s" % (st, seen))

    # ---- Matriz compacta como evidencia (informativa, no altera veredicto) ----
    print("\n  Matriz de lectura (filas vistas | 403 | 'vacia'):")
    print("  %-26s %6s %8s %11s %8s" % ("tabla", "total", "anon", "registered", "admin"))
    interesantes = PRIVATE_FROM_ANON + ["profiles", "ballots", "votes", "proposals",
                                        "opinions", "settings", "audit_log"]
    for t in interesantes:
        if t not in base:
            continue
        cells = []
        for tok in (anon, tok_reg, tok_admin):
            st, seen = _rows_seen(http, t, tok)
            cells.append("403" if st == 403 else ("vacia" if base[t] == 0 and seen == 0 else str(seen)))
        print("  %-26s %6d %8s %11s %8s" % (t, base[t], cells[0], cells[1], cells[2]))
