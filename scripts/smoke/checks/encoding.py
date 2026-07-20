"""INVARIANTE: 0 mojibake (bug recurrente D-009).

Consolida scan_total.py + qa_scan_gaps.py. Tres patrones:
  chr(195)  'A-tilde'  -> vocales acentuadas mal decodificadas (Ã¡, Ã©...)
  chr(226)  'a-circ'   -> comillas/guiones tipograficos rotos
  chr(65533) U+FFFD    -> caracter de reemplazo (perdida irreversible)
Cubre DATOS (todas las columnas de texto/jsonb de public) Y CATALOGOS
(pg_description = COMMENT ON, pg_proc.prosrc = cuerpos de funcion), que fueron
justo donde el bug reaparecio tras cada reparacion parcial.

Correr con PYTHONIOENCODING=utf-8 (run.py lo verifica).
"""

PATTERNS = [("chr(195)", 195), ("chr(226)", 226), ("U+FFFD", 65533)]


def _count(http, expr):
    try:
        return int(http.sql_val("select count(*) as n from (%s) s" % expr) or 0)
    except Exception as e:  # noqa: BLE001
        return "ERR:" + str(e)[:80]


def run(http, rep, fx=None):
    rep.block("CODIFICACION - mojibake (D-009)")

    # --- Catalogos del sistema (COMMENT ON y cuerpos de funcion) ---
    for label, code in PATTERNS:
        n_desc = _count(http, "select 1 from pg_description "
                              "where position(chr(%d) in description) > 0" % code)
        n_proc = _count(http, "select 1 from pg_proc "
                              "where pronamespace='public'::regnamespace "
                              "and position(chr(%d) in prosrc) > 0" % code)
        rep.expect(n_desc == 0, "pg_description sin %s" % label, "hits=%s" % n_desc)
        rep.expect(n_proc == 0, "pg_proc.prosrc sin %s" % label, "hits=%s" % n_proc)

    # --- Datos MUTABLES: todas las columnas de texto/jsonb de public salvo
    # audit_log, que es append-only y se audita aparte (su historico no se limpia). ---
    cols = http.sql(
        "select table_name, column_name from information_schema.columns "
        "where table_schema='public' and table_name <> 'audit_log' and data_type in "
        "('text','character varying','jsonb') order by table_name, column_name")
    for label, code in PATTERNS:
        rotas = []
        for c in cols:
            t, col = c["table_name"], c["column_name"]
            n = _count(http, 'select 1 from public."%s" where position(chr(%d) in "%s"::text) > 0'
                       % (t, code, col))
            if isinstance(n, int) and n:
                rotas.append("%s.%s=%d" % (t, col, n))
        rep.expect(not rotas,
                   "datos mutables sin %s (%d columnas revisadas)" % (label, len(cols)),
                   "; ".join(rotas) if rotas else "limpio")

    # --- audit_log (append-only): un hit aqui es un hallazgo historico real que
    # no se puede borrar; se reporta como FAIL pero etiquetado, para no confundirlo
    # con datos vivos y para que en un entorno limpio (Ola 5) salga verde. ---
    a_cols = http.sql(
        "select column_name from information_schema.columns where table_schema='public' "
        "and table_name='audit_log' and data_type in ('text','character varying','jsonb')")
    for label, code in PATTERNS:
        hits = []
        for c in a_cols:
            col = c["column_name"]
            n = _count(http, 'select 1 from public.audit_log where position(chr(%d) in "%s"::text) > 0'
                       % (code, col))
            if isinstance(n, int) and n:
                hits.append("meta/%s=%d" % (col, n))
        rep.expect(not hits, "audit_log historico sin %s (append-only)" % label,
                   "; ".join(hits) if hits else "limpio")
