"""Carga de configuracion desde el ENTORNO. Cero claves hardcodeadas.

Resolucion de cada valor (primer no-vacio gana):
  RC_BASE_URL          <- RC_BASE_URL | SUPABASE_PUBLIC_URL | BASE_URL
  RC_ANON_KEY          <- RC_ANON_KEY | ANON_KEY
  RC_SERVICE_ROLE_KEY  <- RC_SERVICE_ROLE_KEY | SERVICE_ROLE_KEY
  RC_JWT_SECRET        <- RC_JWT_SECRET | JWT_SECRET
  RC_WEB_URL (opc.)    <- RC_WEB_URL | SITE_URL
  RC_STRIPE_WEBHOOK_SECRET (opc.)

Conveniencia local (NUNCA se commitea): si RC_SMOKE_ENV_FILE apunta a un
fichero KEY=VALUE, se carga en el entorno sin pisar variables ya definidas.
Asi se corre contra `dev` hoy y contra produccion en la Ola 5 cambiando solo
la variable de entorno o el fichero apuntado.
"""
import os


def _load_env_file(path):
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())


def _first(*names):
    for n in names:
        v = os.environ.get(n)
        if v:
            return v
    return None


class Config:
    def __init__(self):
        env_file = os.environ.get("RC_SMOKE_ENV_FILE")
        if env_file and os.path.exists(env_file):
            _load_env_file(env_file)
        self.base_url = (_first("RC_BASE_URL", "SUPABASE_PUBLIC_URL", "BASE_URL") or "").rstrip("/")
        self.anon_key = _first("RC_ANON_KEY", "ANON_KEY")
        self.service_key = _first("RC_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY")
        self.jwt_secret = _first("RC_JWT_SECRET", "JWT_SECRET")
        # opcionales. RC_WEB_URL debe fijarse EXPLICITAMENTE para activar los
        # checks de capa web: que exista SITE_URL en el .env no implica que la app
        # este desplegada y sirviendo con las cabeceras correctas (evita falsos rojos).
        self.web_url = (_first("RC_WEB_URL") or "").rstrip("/") or None
        self.stripe_webhook_secret = _first("RC_STRIPE_WEBHOOK_SECRET")

    def require_core(self):
        """Lanza si falta algo imprescindible. Nunca imprime valores."""
        missing = [name for name, val in [
            ("RC_BASE_URL", self.base_url),
            ("RC_ANON_KEY", self.anon_key),
            ("RC_SERVICE_ROLE_KEY", self.service_key),
            ("RC_JWT_SECRET", self.jwt_secret),
        ] if not val]
        if missing:
            raise SystemExit(
                "Faltan variables de entorno: " + ", ".join(missing) +
                "\nDefinelas en el entorno o apunta RC_SMOKE_ENV_FILE a un fichero KEY=VALUE.\n"
                "(ver scripts/smoke/README.md)"
            )
