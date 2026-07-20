"""Recolector de resultados: verde/rojo + resumen + codigo de salida.

Estados:
  PASS  invariante se sostiene
  FAIL  invariante ROTO -> el runner sale con codigo 1
  SKIP  no comprobable en este entorno (p.ej. requiere Ollama/despliegue)
"""
import sys

PASS, FAIL, SKIP = "PASS", "FAIL", "SKIP"

_USE_COLOR = sys.stdout.isatty()
_C = {"PASS": "\033[32m", "FAIL": "\033[31m", "SKIP": "\033[33m", "0": "\033[0m",
      "bold": "\033[1m", "dim": "\033[2m"}


def _col(key, text):
    if not _USE_COLOR:
        return text
    return _C.get(key, "") + text + _C["0"]


class Report:
    def __init__(self):
        self.results = []      # (block, status, title, evidence)
        self.current = None

    def block(self, name):
        self.current = name
        print("\n" + _col("bold", "== " + name + " =="))

    def _add(self, status, title, evidence=""):
        self.results.append((self.current, status, title, evidence))
        tag = _col(status, "[%s]" % status)
        print("  %s %s" % (tag, title))
        if evidence:
            print("        " + _col("dim", str(evidence)[:220]))

    def ok(self, title, evidence=""):
        self._add(PASS, title, evidence)

    def fail(self, title, evidence=""):
        self._add(FAIL, title, evidence)

    def skip(self, title, evidence=""):
        self._add(SKIP, title, evidence)

    def expect(self, condition, title, evidence=""):
        """Azucar: PASS si condition es verdadero, si no FAIL."""
        (self.ok if condition else self.fail)(title, evidence)
        return bool(condition)

    def counts(self):
        c = {PASS: 0, FAIL: 0, SKIP: 0}
        for _, st, _, _ in self.results:
            c[st] += 1
        return c

    def summary_and_exit(self, extra_fail=False):
        c = self.counts()
        print("\n" + _col("bold", "=" * 60))
        print(_col("bold", "RESUMEN SMOKE RAZON COMUN"))
        print("  " + _col(PASS, "PASS %d" % c[PASS]) + "   " +
              _col(FAIL, "FAIL %d" % c[FAIL]) + "   " +
              _col(SKIP, "SKIP %d" % c[SKIP]))
        if c[FAIL]:
            print("\n  " + _col(FAIL, "FALLOS:"))
            for blk, st, title, ev in self.results:
                if st == FAIL:
                    print("   - [%s] %s" % (blk, title))
        red = c[FAIL] > 0 or extra_fail
        veredicto = _col(FAIL, "ROJO (algun invariante roto)") if red else _col(PASS, "VERDE (todos los invariantes se sostienen)")
        print("\n  Veredicto: " + veredicto)
        print(_col("bold", "=" * 60))
        sys.exit(1 if red else 0)
