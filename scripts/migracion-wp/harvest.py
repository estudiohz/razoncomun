# -*- coding: utf-8 -*-
"""
harvest.py — Paso 1 de la migración del WordPress (ejecutar MIENTRAS el
WordPress esté vivo, antes del corte de la Ola 5).

Descarga de `https://www.razoncomun.com/wp-json/wp/v2/` los datos y las
imágenes referenciadas por el contenido que se migra (24 entradas + 7
propuestas: portadas + imágenes del cuerpo), y deja en disco:

  scripts/migracion-wp/
    wp-snapshot.json   -> datos mínimos (posts, propuestas, cats) reutilizables
                          en la Ola 5 aunque el WordPress ya esté apagado.
    assets/<año>/<fichero>   -> las imágenes (contenido público del partido).
    assets/manifest.json     -> mapa {url_wp -> ruta_storage_relativa}.

El paso 2 (load.py) NO vuelve a tocar el WordPress: trabaja solo con estos
ficheros, por eso la migración es reejecutable contra la base de producción
limpia en la Ola 5.
"""
from __future__ import annotations
import json
import os
import re
import ssl
import sys
import urllib.parse
import urllib.request

WP = "https://www.razoncomun.com/wp-json/wp/v2/"
HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "assets")
CTX = ssl.create_default_context()
UA = {"User-Agent": "razoncomun-migracion/1.0"}
UPLOADS_RE = re.compile(r"https?://(?:www\.)?razoncomun\.com/wp-content/uploads/([^\s\"')]+)")


def _get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, context=CTX, timeout=90) as r:
        return json.load(r)


def _get_all(tipo, embed=False):
    out, page = [], 1
    while True:
        url = f"{WP}{tipo}?per_page=100&page={page}" + ("&_embed=1" if embed else "")
        try:
            data = _get(url)
        except urllib.error.HTTPError as e:
            if e.code == 400:
                break
            raise
        if not data:
            break
        out.extend(data)
        if len(data) < 100:
            break
        page += 1
    return out


def _featured_url(item):
    emb = item.get("_embedded", {})
    fm = emb.get("wp:featuredmedia")
    if fm and isinstance(fm, list) and fm and fm[0].get("source_url"):
        return fm[0]["source_url"]
    return None


def _uploads_in(html):
    return set(UPLOADS_RE.findall(html or ""))


def main():
    os.makedirs(ASSETS, exist_ok=True)
    print("Descargando datos del WordPress...")
    posts = _get_all("posts", embed=True)
    props = _get_all("propuesta", embed=True)
    cats = _get_all("categories")
    print(f"  posts={len(posts)} propuestas={len(props)} categorias={len(cats)}")

    # --- recolecta URLs de imágenes: portadas (path completo) + cuerpo (relativas) ---
    url_set = set()  # urls absolutas a descargar

    def collect(item):
        fu = _featured_url(item)
        if fu:
            url_set.add(fu)
        for rel in _uploads_in(item["content"]["rendered"]):
            url_set.add("https://www.razoncomun.com/wp-content/uploads/" + rel)

    for it in posts + props:
        collect(it)

    print(f"Imágenes referenciadas: {len(url_set)}")

    # --- descarga + manifest ---
    manifest = {}  # url_wp_absoluta -> ruta relativa dentro del bucket 'blog'
    ok = fail = 0
    for url in sorted(url_set):
        m = re.search(r"/wp-content/uploads/(.+)$", url)
        if not m:
            continue
        rel = m.group(1)  # p.ej. 2026/06/congreso.webp
        dest = os.path.join(ASSETS, rel.replace("/", os.sep))
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        manifest[url] = rel
        if os.path.exists(dest) and os.path.getsize(dest) > 0:
            ok += 1
            continue
        # Percent-encoda solo la parte de ruta (deja intactos esquema/host);
        # las URLs con acentos/em-dash en el nombre de fichero fallan si no.
        parts = urllib.parse.urlsplit(url)
        safe = urllib.parse.urlunsplit(
            (parts.scheme, parts.netloc, urllib.parse.quote(parts.path), parts.query, "")
        )
        try:
            req = urllib.request.Request(safe, headers=UA)
            with urllib.request.urlopen(req, context=CTX, timeout=120) as r:
                data = r.read()
            with open(dest, "wb") as f:
                f.write(data)
            ok += 1
        except Exception as e:  # noqa
            fail += 1
            print(f"  FALLO {url}: {e}")

    json.dump(manifest, open(os.path.join(ASSETS, "manifest.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=0)

    # --- snapshot mínimo (para reejecutar sin WordPress) ---
    def trim_post(p):
        return {
            "id": p["id"], "slug": p["slug"], "date": p["date"], "modified": p["modified"],
            "title": p["title"]["rendered"], "excerpt": p["excerpt"]["rendered"],
            "content": p["content"]["rendered"], "categories": p.get("categories", []),
            "featured_url": _featured_url(p), "link": p.get("link"),
        }

    def trim_prop(p):
        return {
            "id": p["id"], "slug": p["slug"], "date": p["date"], "modified": p["modified"],
            "title": p["title"]["rendered"], "content": p["content"]["rendered"],
            "featured_url": _featured_url(p), "link": p.get("link"),
        }

    snapshot = {
        "posts": [trim_post(p) for p in posts],
        "propuestas": [trim_prop(p) for p in props],
        "categories": [{"id": c["id"], "slug": c["slug"], "name": c["name"]} for c in cats],
    }
    json.dump(snapshot, open(os.path.join(HERE, "wp-snapshot.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)

    print(f"Imágenes: {ok} ok, {fail} fallidas. Manifest: {len(manifest)} entradas.")
    print("Snapshot escrito en wp-snapshot.json")


if __name__ == "__main__":
    sys.exit(main())
