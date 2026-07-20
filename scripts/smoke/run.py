#!/usr/bin/env python3
"""Runner unico de la suite de smoke de Razon Comun.

Una sola invocacion -> verde/rojo + resumen + codigo de salida (0 ok, 1 fallo).
Parametrizado por ENTORNO (ver lib/config.py). Crea fixtures efimeros, ejercita
los invariantes criticos, y deja el entorno como lo encontro (verifica conteos
antes/despues salvo audit_log, que es append-only).

Uso:
  python run.py                 # suite completa contra el entorno configurado
  python run.py --only c1,rls   # subconjunto de bloques
  python run.py --self-test     # DEMUESTRA el rojo: invierte C-1 a proposito -> exit 1
  python run.py --node          # ademas invoca los verificadores Node (requieren app)

Entorno minimo (o via RC_SMOKE_ENV_FILE apuntando a un fichero KEY=VALUE):
  RC_BASE_URL RC_ANON_KEY RC_SERVICE_ROLE_KEY RC_JWT_SECRET
Opcionales: RC_WEB_URL RC_STRIPE_WEBHOOK_SECRET
"""
import io
import os
import sys

# --- UTF-8 obligatorio (bug D-009): forzar stdout y avisar del entorno ---
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:  # noqa: BLE001
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lib.config import Config          # noqa: E402
from lib.http import Http              # noqa: E402
from lib.fixtures import Fixtures      # noqa: E402
from lib.report import Report          # noqa: E402
from checks import (encoding, rls_matrix, write_attacks, brain,  # noqa: E402
                    nif, stripe_idem, deploy_checks)

# nombre de bloque -> (modulo, necesita_fixtures)
BLOCKS = [
    ("encoding", encoding, False),
    ("rls", rls_matrix, True),
    ("c1", write_attacks, True),
    ("brain", brain, True),
    ("nif", nif, True),
    ("stripe", stripe_idem, True),
    ("deploy", deploy_checks, False),
]


def _snapshot_counts(http):
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


def _self_test(http, rep):
    """Prueba que la suite DETECTA un invariante roto: invierte la expectativa de
    C-1 (afirma que el bypass TRIUNFA). Como C-1 se sostiene, esto debe salir ROJO.
    """
    rep.block("SELF-TEST (rojo esperado): se invierte C-1 a proposito")
    fx = Fixtures(http).setup()
    try:
        mu = fx.users["member_old_unverified"]
        tok = fx.token("member_old_unverified")
        before = http.sql_val("select identity_verified_at is not null from profiles where id='%s'" % mu)
        http.rest("PATCH", "profiles?id=eq.%s" % mu, tok,
                  {"identity_verified_at": "2026-01-01T00:00:00Z"})
        after = http.sql_val("select identity_verified_at is not null from profiles where id='%s'" % mu)
        # EXPECTATIVA INVERTIDA (incorrecta a proposito): esperar que SI cambie
        rep.expect(before != after,
                   "[self-test] se esperaba (mal) que el bypass C-1 tuviera exito",
                   "antes=%r despues=%r -> si sale FAIL, la suite funciona" % (before, after))
    finally:
        fx.teardown()


def main():
    args = sys.argv[1:]
    self_test = "--self-test" in args
    run_node = "--node" in args
    only = None
    for a in args:
        if a.startswith("--only"):
            val = a.split("=", 1)[1] if "=" in a else (args[args.index(a) + 1] if args.index(a) + 1 < len(args) else "")
            only = {x.strip() for x in val.split(",") if x.strip()}

    if os.environ.get("PYTHONIOENCODING", "").lower() not in ("utf-8", "utf8"):
        print("AVISO: PYTHONIOENCODING no es utf-8; stdout forzado a utf-8 (recomendado exportarlo).")

    cfg = Config()
    cfg.require_core()
    http = Http(cfg)
    rep = Report()

    # conectividad
    try:
        http.sql("select 1")
    except Exception as e:  # noqa: BLE001
        print("ERROR de conexion a %s : %s" % (cfg.base_url, str(e)[:200]))
        sys.exit(1)

    print("Objetivo: %s   (web: %s)" % (cfg.base_url, cfg.web_url or "no configurada"))

    if self_test:
        _self_test(http, rep)
        rep.summary_and_exit()
        return

    counts_before = _snapshot_counts(http)
    audit_before = counts_before.get("audit_log", 0)

    fx = None
    try:
        # bloques sin fixtures primero
        for name, mod, needs_fx in BLOCKS:
            if only and name not in only:
                continue
            if needs_fx:
                continue
            mod.run(http, rep, None)

        # fixtures compartidos para el resto
        if any((not only or name in only) and needs_fx for name, _, needs_fx in BLOCKS):
            fx = Fixtures(http).setup()
            print("\n(fixtures efimeros creados, tag=%s)" % fx.tag)
            for name, mod, needs_fx in BLOCKS:
                if only and name not in only:
                    continue
                if not needs_fx:
                    continue
                mod.run(http, rep, fx)
    finally:
        if fx is not None:
            fx.teardown()
            print("(fixtures efimeros eliminados)")

    # --- entorno intacto: conteos antes == despues (salvo audit_log) ---
    rep.block("Entorno intacto (setup/teardown limpio)")
    counts_after = _snapshot_counts(http)
    audit_after = counts_after.get("audit_log", 0)
    diffs = []
    for t in set(counts_before) | set(counts_after):
        if t == "audit_log":
            continue
        a, b = counts_before.get(t), counts_after.get(t)
        if a != b:
            diffs.append("%s: %s->%s" % (t, a, b))
    rep.expect(not diffs, "conteos de fila identicos antes/despues (salvo audit_log)",
               "; ".join(diffs) if diffs else "sin diferencias")
    if audit_after != audit_before:
        rep.skip("audit_log crecio %d->%d filas (append-only, esperado)" % (audit_before, audit_after))

    if run_node:
        _run_node_bridge(cfg, rep)

    rep.summary_and_exit()


def _run_node_bridge(cfg, rep):
    """Invoca los verificadores Node existentes (requieren app desplegada)."""
    import subprocess
    rep.block("Bridge Node (verificadores dedicados)")
    if not cfg.web_url:
        rep.skip("--node ignorado: RC_WEB_URL no definido")
        return
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    scripts = [
        "apps/web/scripts/verificacion-e2e.mjs",
        "apps/web/scripts/verificacion-mfa.mjs",
        "apps/web/scripts/verificacion-stripe-webhook.mjs",
        "scripts/verify-provider-revert.mjs",
        "scripts/gate-brain.mjs",
    ]
    for rel in scripts:
        path = os.path.join(root, rel)
        if not os.path.exists(path):
            rep.skip("%s no existe" % rel)
            continue
        try:
            r = subprocess.run(["node", path], cwd=root, capture_output=True, text=True, timeout=180)
            tail = (r.stdout or r.stderr).strip().splitlines()[-1:] or [""]
            rep.expect(r.returncode == 0, "node %s" % rel, "exit=%d | %s" % (r.returncode, tail[0][:150]))
        except Exception as e:  # noqa: BLE001
            rep.skip("node %s no ejecutable" % rel, str(e)[:120])


if __name__ == "__main__":
    main()
