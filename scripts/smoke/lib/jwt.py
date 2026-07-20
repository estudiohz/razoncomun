"""Firma de JWT HS256 al estilo Supabase, para simular usuarios en pruebas.

auth.uid() en Postgres lee el claim `sub`; RLS lo evalua sin necesidad de que
exista sesion real. El secreto viene de la config (entorno), nunca del codigo.
"""
import base64
import hashlib
import hmac
import json
import time


def _b64u(raw):
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def mint(secret, sub, role="authenticated", ttl=3600):
    now = int(time.time())
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {"aud": "authenticated", "role": role, "iss": "supabase",
               "iat": now, "exp": now + ttl}
    if sub:
        payload["sub"] = sub
    signing_input = (
        _b64u(json.dumps(header, separators=(",", ":")).encode()) + "." +
        _b64u(json.dumps(payload, separators=(",", ":")).encode())
    )
    sig = hmac.new(secret.encode(), signing_input.encode(), hashlib.sha256).digest()
    return signing_input + "." + _b64u(sig)
