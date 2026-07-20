# -*- coding: utf-8 -*-
"""
load.py — Paso 2 de la migración del WordPress. REEJECUTABLE e IDEMPOTENTE.

Trabaja SOLO con los ficheros locales que dejó harvest.py (wp-snapshot.json +
assets/), nunca con el WordPress: por eso se puede reejecutar contra la base de
producción limpia en la Ola 5 aunque el WordPress ya esté apagado.

Qué hace:
  1. Crea (si falta) el bucket público de Storage `blog` y sube las imágenes
     del contenido migrado (idempotente, x-upsert).
  2. Asegura las categorías nuevas (ADN, Empleo, Noticias, Asturias, Cultura,
     Gobierno, Seguridad y Defensa) sin duplicar las ya sembradas.
  3. Inserta las 24 entradas en `articles` (source_type=editorial,
     status=published, slug y fecha originales) — delete-then-insert por slug.
  4. Inserta las 7 propuestas oficiales en `proposals`
     (status=adopted, origin=official) — delete-then-insert por título.
  5. Reescribe TODAS las URLs de imagen (portada + cuerpo) a Storage.
  6. Verifica 0 mojibake en los tres patrones (Ã / â‚¬ / U+FFFD).

Requisitos de entorno (NUNCA en el repo):
  SUPABASE_ENV  -> ruta a un fichero .env con SUPABASE_PUBLIC_URL y
                   SERVICE_ROLE_KEY. Por defecto usa la ruta de scratchpad.

Uso:
  python -X utf8 load.py           # migra
  python -X utf8 load.py --verify  # solo re-verifica mojibake
"""
from __future__ import annotations
import json
import mimetypes
import os
import re
import ssl
import sys
import urllib.parse
import urllib.request

from htmlmd import html_a_markdown

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "assets")
CTX = ssl.create_default_context()

DEFAULT_ENV = ("C:/Users/sergi/AppData/Local/Temp/claude/"
               "D--R-Razon-Comun/1e38b119-1e2a-4efb-a51e-d7a6167427ce/scratchpad/supabase.env")

# --- mapeos de negocio (decisiones del brief) --------------------------------

# Categoría WP -> slug de categoría en la base (0010_blog + seed 0003).
WP_CAT_SLUG_TO_DB = {
    "agricultura-y-ganaderia": "agricultura-ganaderia",
}  # el resto coincide slug a slug (se resuelve por igualdad)

# Categorías nuevas a crear (slug, nombre, color de marca — nunca azul dominante).
CATEGORIAS_NUEVAS = [
    ("adn", "ADN", "#C3369E"),               # magenta — identidad del partido
    ("empleo", "Empleo", "#16B8A0"),          # teal
    ("noticias", "Noticias", "#2BC7E8"),      # cian
    ("asturias", "Asturias", "#E8792F"),      # naranja
    ("cultura", "Cultura", "#8B30D9"),        # morado
    ("gobierno", "Gobierno", "#1B3D9C"),      # azul (solo como etiqueta puntual)
    ("seguridad-y-defensa", "Seguridad y Defensa", "#16B8A0"),  # teal
]

# Categorías "genéricas": se prefiere una temática como categoría principal.
CAT_GENERICAS = {"adn", "noticias"}

# Departamento de cada propuesta oficial (proposals.department es obligatorio).
PROP_DEPARTAMENTO = {
    "propuesta-integral-de-vivienda-1-0-de-razon-comun": "vivienda",
    "eliminacion-del-impuesto-de-sucesiones": "economia",
    "50-areas-de-despilfarro-publico-en-espana": "gasto-publico",
    "vacaciones-pagadas-autonomos-plan-de-viabilidad": "autonomos",
    "devolucion-de-1-cuota-correspondiente-a-vacaciones": "autonomos",
    "nuevo-sistema-de-cotizacion-reta": "autonomos",
    "lenguas-en-espana-respeto-educacion-y-libertad": "educacion",
}

# =============================================================================
# Infraestructura: env, HTTP a pg/query y Storage
# =============================================================================

def cargar_env():
    ruta = os.environ.get("SUPABASE_ENV", DEFAULT_ENV)
    env = {}
    with open(ruta, encoding="utf-8") as f:
        for l in f:
            l = l.strip()
            if "=" in l and not l.startswith("#"):
                k, v = l.split("=", 1)
                env[k] = v
    base = env["SUPABASE_PUBLIC_URL"].rstrip("/")
    sr = env["SERVICE_ROLE_KEY"]
    return base, sr


BASE, SR = cargar_env()
STORAGE_PUBLIC = f"{BASE}/storage/v1/object/public/blog"


def key_safe(rel: str) -> str:
    """Clave de Storage ASCII-segura. Supabase Storage rechaza claves con
    caracteres como '—' (U+2014) o '¦' (U+00A6): 5 imágenes del WordPress traen
    nombres de fichero con esos símbolos. Se transliteran a '-'. Se aplica
    IDÉNTICO en la subida y en la reescritura de URLs para que casen."""
    rel = rel.split("?")[0]
    return "".join(ch if (ch.isascii() and (ch.isalnum() or ch in "._/-")) else "-"
                   for ch in rel)


def pg(sql: str):
    """Ejecuta SQL por POST /pg/query con UTF-8 explícito (lección D-009/D-014)."""
    body = json.dumps({"query": sql}).encode("utf-8")  # <- UTF-8 explícito
    req = urllib.request.Request(
        BASE + "/pg/query", data=body, method="POST",
        headers={
            "apikey": SR,
            "Authorization": f"Bearer {SR}",
            "content-type": "application/json; charset=utf-8",
            "content-length": str(len(body)),  # longitud en BYTES
        },
    )
    try:
        with urllib.request.urlopen(req, context=CTX, timeout=60) as r:
            txt = r.read().decode("utf-8")
            return json.loads(txt) if txt.strip() else []
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"pg error {e.code}: {e.read().decode('utf-8','replace')}") from None


def storage(method, path, body=None, ct="application/json"):
    data = body if isinstance(body, (bytes, bytearray)) else (
        json.dumps(body).encode("utf-8") if body is not None else None)
    req = urllib.request.Request(
        BASE + "/storage/v1" + path, data=data, method=method,
        headers={"apikey": SR, "Authorization": f"Bearer {SR}", "content-type": ct,
                 "x-upsert": "true"},
    )
    try:
        with urllib.request.urlopen(req, context=CTX, timeout=120) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


# --- helpers SQL -------------------------------------------------------------

def s(v):
    """Literal SQL: texto con comillas simples dobladas, o NULL."""
    if v is None:
        return "NULL"
    return "'" + str(v).replace("'", "''") + "'"


def s_arr(items):
    """text[] literal."""
    if not items:
        return "'{}'"
    inner = ",".join('"' + str(i).replace("\\", "\\\\").replace('"', '\\"') + '"' for i in items)
    return "'{" + inner + "}'"


# =============================================================================
# Paso 1: bucket + subida de imágenes
# =============================================================================

def asegurar_bucket():
    st, txt = storage("GET", "/bucket/blog")
    if st == 200:
        print("  bucket 'blog' ya existe")
        return
    st, txt = storage("POST", "/bucket", {
        "id": "blog", "name": "blog", "public": True,
        "file_size_limit": 10485760,  # 10 MB
        "allowed_mime_types": ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"],
    })
    print(f"  crear bucket 'blog': {st} {txt[:120]}")


def subir_imagenes(manifest):
    ok = fail = 0
    for url, rel in manifest.items():
        local = os.path.join(ASSETS, rel.replace("/", os.sep))
        if not os.path.exists(local):
            fail += 1
            print(f"  falta asset local: {rel}")
            continue
        ct = mimetypes.guess_type(local)[0] or "application/octet-stream"
        with open(local, "rb") as f:
            data = f.read()
        # clave ASCII-segura + percent-encode por segmento
        enc = "/".join(urllib.parse.quote(p) for p in key_safe(rel).split("/"))
        st, txt = storage("POST", f"/object/blog/{enc}", body=data, ct=ct)
        if st in (200, 201):
            ok += 1
        else:
            fail += 1
            print(f"  FALLO subida {rel}: {st} {txt[:100]}")
    print(f"  imágenes subidas: {ok} ok, {fail} fallidas")
    return ok, fail


# =============================================================================
# Paso 2: categorías
# =============================================================================

def asegurar_categorias():
    valores = ",".join(f"({s(sl)},{s(nm)},{s(col)})" for sl, nm, col in CATEGORIAS_NUEVAS)
    pg(f"insert into categories (slug,name,color) values {valores} "
       f"on conflict (slug) do nothing")
    filas = pg("select id, slug from categories")
    return {f["slug"]: f["id"] for f in filas}


def cat_id_para_post(post, slug_to_id, cat_by_id_slug):
    """Categoría principal: prefiere una temática sobre adn/noticias."""
    wp_slugs = [cat_by_id_slug.get(cid) for cid in post.get("categories", [])]
    wp_slugs = [x for x in wp_slugs if x]
    # traduce al slug de la base
    db_slugs = [WP_CAT_SLUG_TO_DB.get(x, x) for x in wp_slugs]
    # 1) primera no genérica presente en la base
    for orig, db in zip(wp_slugs, db_slugs):
        if orig not in CAT_GENERICAS and db in slug_to_id:
            return slug_to_id[db]
    # 2) genérica (adn antes que noticias)
    for pref in ("adn", "noticias"):
        if pref in wp_slugs and pref in slug_to_id:
            return slug_to_id[pref]
    # 3) cualquiera que exista
    for db in db_slugs:
        if db in slug_to_id:
            return slug_to_id[db]
    return None


# =============================================================================
# Reescritura de URLs de imagen WP -> Storage
# =============================================================================

def hacer_rewriters(manifest):
    """Devuelve (image_rewriter, link_rewriter, cover_rewriter)."""
    def rel_de(url):
        m = re.search(r"/wp-content/uploads/(.+)$", url or "")
        if not m:
            return None
        rel = m.group(1)
        # normaliza: la URL puede venir con querystring
        rel = rel.split("?")[0]
        return rel

    def a_storage(url):
        rel = rel_de(url)
        if rel is None:
            return url
        enc = "/".join(urllib.parse.quote(p) for p in key_safe(rel).split("/"))
        return f"{STORAGE_PUBLIC}/{enc}"

    def image_rewriter(url):
        if url and "/wp-content/uploads/" in url:
            return a_storage(url)
        return url

    def link_rewriter(url):
        # enlaces internos al WordPress que apunten a uploads -> Storage;
        # el resto de enlaces se dejan intactos.
        if url and "/wp-content/uploads/" in url:
            return a_storage(url)
        return url

    return image_rewriter, link_rewriter, a_storage


# =============================================================================
# Transformación de contenido
# =============================================================================

def limpiar_excerpt(html):
    txt = re.sub(r"<[^>]+>", "", html or "")
    txt = txt.replace("&nbsp;", " ").replace("&hellip;", "…")
    txt = re.sub(r"&#8230;|\[…\]|\[&hellip;\]|\[…\]", "", txt)
    txt = re.sub(r"\s+", " ", txt).strip()
    return txt


def recortar(txt, n):
    if not txt:
        return None
    txt = txt.strip()
    if len(txt) <= n:
        return txt
    corte = txt[:n]
    if " " in corte:
        corte = corte[:corte.rfind(" ")]
    return corte.rstrip(" ,.;:") + "…"


# =============================================================================
# Inserción de artículos y propuestas
# =============================================================================

def migrar_articulos(snapshot, slug_to_id, cat_by_id_slug, img_rw, link_rw, cover_rw):
    posts = snapshot["posts"]
    n = 0
    for p in posts:
        slug = p["slug"]
        body_md, _emb = html_a_markdown(p["content"], image_rewriter=img_rw, link_rewriter=link_rw)
        cover = cover_rw(p["featured_url"]) if p.get("featured_url") else None
        excerpt = limpiar_excerpt(p.get("excerpt", ""))
        if not excerpt:
            from htmlmd import _clean_inline  # reutiliza colapsado de espacios
            excerpt = recortar(re.sub(r"[#>*`|\-]", " ", body_md), 260)
        excerpt = recortar(excerpt, 300)
        title = re.sub(r"<[^>]+>", "", p["title"]).strip()
        cat_id = cat_id_para_post(p, slug_to_id, cat_by_id_slug)
        fecha = p["date"]  # fecha original (hora local del sitio)
        seo_desc = recortar(excerpt, 160)

        pg(f"delete from articles where slug = {s(slug)}")
        pg(
            "insert into articles "
            "(slug,title,excerpt,body,category_id,cover_image,author_id,source_type,"
            " source_urls,status,published_at,seo_title,seo_desc,created_at) values ("
            f"{s(slug)},{s(title)},{s(excerpt)},{s(body_md)},"
            f"{cat_id if cat_id else 'NULL'},{s(cover)},NULL,'editorial',"
            f"'{{}}','published',{s(fecha)},{s(recortar(title,60))},{s(seo_desc)},{s(fecha)})"
        )
        n += 1
    print(f"  artículos migrados: {n}")
    return n


def migrar_propuestas(snapshot, img_rw, link_rw, cover_rw):
    props = snapshot["propuestas"]
    n = 0
    for p in props:
        slug = p["slug"]
        title = re.sub(r"<[^>]+>", "", p["title"]).strip()
        dep = PROP_DEPARTAMENTO.get(slug, "economia")
        body_md, _ = html_a_markdown(p["content"], image_rewriter=img_rw, link_rewriter=link_rw)
        # la portada de la propuesta no tiene columna propia: se antepone al
        # cuerpo como imagen para no perderla.
        if p.get("featured_url"):
            cover = cover_rw(p["featured_url"])
            body_md = f"![{title}]({cover})\n\n" + body_md
        fecha = p["date"]
        pg(f"delete from proposals where origin='official' and title = {s(title)}")
        pg(
            "insert into proposals (title,body,department,status,origin,created_at,updated_at) "
            f"values ({s(title)},{s(body_md)},{s(dep)},'adopted','official',{s(fecha)},{s(fecha)})"
        )
        n += 1
    print(f"  propuestas oficiales migradas: {n}")
    return n


# =============================================================================
# Verificación de mojibake (los TRES patrones)
# =============================================================================

def verificar_mojibake():
    print("\n=== Verificación de mojibake (debe ser 0 en los tres patrones) ===")
    total = 0
    checks = [
        ("articles.title", "select count(*) c from articles where position(chr(195) in title)>0 or position(chr(226) in title)>0 or position(chr(65533) in title)>0"),
        ("articles.body", "select count(*) c from articles where position(chr(195) in body)>0 or position(chr(226) in body)>0 or position(chr(65533) in body)>0"),
        ("articles.excerpt", "select count(*) c from articles where position(chr(195) in coalesce(excerpt,''))>0 or position(chr(226) in coalesce(excerpt,''))>0 or position(chr(65533) in coalesce(excerpt,''))>0"),
        ("proposals.title", "select count(*) c from proposals where position(chr(195) in title)>0 or position(chr(226) in title)>0 or position(chr(65533) in title)>0"),
        ("proposals.body", "select count(*) c from proposals where position(chr(195) in body)>0 or position(chr(226) in body)>0 or position(chr(65533) in body)>0"),
        ("categories", "select count(*) c from categories where position(chr(195) in name)>0 or position(chr(226) in name)>0 or position(chr(65533) in name)>0"),
    ]
    for etiqueta, sql in checks:
        c = pg(sql)[0]["c"]
        total += int(c)
        marca = "OK" if int(c) == 0 else "  <-- MOJIBAKE"
        print(f"  {etiqueta:<22} {c}  {marca}")
    # sanity: que los acentos SÍ están (contraprueba)
    con_acentos = pg("select count(*) c from articles where body like '%ó%' or body like '%é%'")[0]["c"]
    con_euro = pg("select count(*) c from articles where position(chr(8364) in body)>0")[0]["c"]
    print(f"  (contraprueba) artículos con acentos: {con_acentos} · con € correcto: {con_euro}")
    print(f"  TOTAL mojibake: {total}")
    return total


# =============================================================================
# main
# =============================================================================

def main():
    solo_verificar = "--verify" in sys.argv
    if solo_verificar:
        verificar_mojibake()
        return 0

    snapshot = json.load(open(os.path.join(HERE, "wp-snapshot.json"), encoding="utf-8"))
    manifest = json.load(open(os.path.join(ASSETS, "manifest.json"), encoding="utf-8"))
    cat_by_id_slug = {c["id"]: c["slug"] for c in snapshot["categories"]}

    print("== 1. Storage ==")
    asegurar_bucket()
    subir_imagenes(manifest)

    print("== 2. Categorías ==")
    slug_to_id = asegurar_categorias()
    print(f"  categorías en base: {len(slug_to_id)}")

    print("== 3-5. Contenido ==")
    img_rw, link_rw, cover_rw = hacer_rewriters(manifest)
    migrar_articulos(snapshot, slug_to_id, cat_by_id_slug, img_rw, link_rw, cover_rw)
    migrar_propuestas(snapshot, img_rw, link_rw, cover_rw)

    print("== 6. Verificación ==")
    total = verificar_mojibake()

    # resumen de conteos
    print("\n=== Conteos finales ===")
    r = pg("select "
           "(select count(*) from articles where source_type='editorial' and status='published') art,"
           "(select count(*) from proposals where origin='official') prop,"
           "(select count(*) from categories) cat")[0]
    print(f"  articles editorial/published: {r['art']}")
    print(f"  proposals origin=official:    {r['prop']}")
    print(f"  categories:                   {r['cat']}")
    return 0 if total == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
