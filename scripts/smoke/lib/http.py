"""Clientes HTTP: SQL admin (/pg/query), PostgREST (/rest/v1) y web (opcional).

Nota D-009: /pg/query exige UTF-8 explicito en content-type y content-length;
sin ello los acentos espanoles se corrompen. Todo el modulo fuerza utf-8.
"""
import json
import urllib.error
import urllib.request


class Http:
    def __init__(self, cfg):
        self.cfg = cfg

    # ---- SQL como service_role (linea base / setup / teardown / verificacion) ----
    def sql(self, query):
        body = json.dumps({"query": query}).encode("utf-8")
        req = urllib.request.Request(self.cfg.base_url + "/pg/query", data=body, method="POST")
        req.add_header("apikey", self.cfg.service_key)
        req.add_header("Authorization", "Bearer " + self.cfg.service_key)
        req.add_header("content-type", "application/json; charset=utf-8")
        req.add_header("content-length", str(len(body)))
        try:
            with urllib.request.urlopen(req, timeout=90) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            raise RuntimeError("SQL error: " + e.read().decode("utf-8")[:300])

    def sql_val(self, query):
        """Devuelve la primera celda de la primera fila (o None)."""
        rows = self.sql(query)
        if not rows:
            return None
        first = rows[0]
        return next(iter(first.values())) if first else None

    # ---- PostgREST como un usuario concreto (apikey = ANON, Bearer = su JWT) ----
    def rest(self, method, path, token, body=None, prefer=None):
        """Devuelve (status, texto). apikey siempre = ANON_KEY (clave de consumidor
        de Kong); la identidad va en Authorization: Bearer <JWT del usuario>."""
        url = self.cfg.base_url + "/rest/v1/" + path
        data = json.dumps(body).encode("utf-8") if body is not None else None
        req = urllib.request.Request(url, data=data, method=method)
        req.add_header("apikey", self.cfg.anon_key)
        req.add_header("Authorization", "Bearer " + token)
        req.add_header("content-type", "application/json; charset=utf-8")
        if prefer:
            req.add_header("Prefer", prefer)
        try:
            with urllib.request.urlopen(req, timeout=45) as resp:
                return resp.status, resp.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode("utf-8")
        except Exception as e:  # noqa: BLE001
            return -1, str(e)

    def rest_json(self, method, path, token, body=None, prefer=None):
        st, txt = self.rest(method, path, token, body, prefer)
        try:
            return st, json.loads(txt)
        except Exception:  # noqa: BLE001
            return st, txt

    # ---- Web (Next.js) opcional: SEO, cabeceras, /chat ----
    def web(self, path, method="GET", headers=None, body=None):
        if not self.cfg.web_url:
            return None
        url = self.cfg.web_url + path
        data = body.encode("utf-8") if isinstance(body, str) else body
        req = urllib.request.Request(url, data=data, method=method)
        for k, v in (headers or {}).items():
            req.add_header(k, v)
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return resp.status, dict(resp.headers), resp.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            return e.code, dict(e.headers), e.read().decode("utf-8", "replace")
        except Exception as e:  # noqa: BLE001
            return -1, {}, str(e)
