# Migración del WordPress oficial → base nueva (rc-05-blog)

Migra TODO el contenido de `https://www.razoncomun.com` (WordPress) a la base de
Razón Común. **No modifica el esquema** (propiedad de rc-02): escribe en las
tablas ya existentes `articles`, `proposals`, `categories`.

## Qué migra

| Origen WP | Destino | Notas |
|---|---|---|
| 24 entradas (`posts`) | `articles` (`source_type='editorial'`, `status='published'`) | slug y fecha originales; HTML→markdown; basura de IA eliminada |
| 7 `propuesta` | `proposals` (`status='adopted'`, `origin='official'`) | documentos de posición oficial (D-019), no propuestas ciudadanas |
| 20 categorías + 11 departamentos | `categories` | mapeadas a las ya sembradas; se crean 7 nuevas sin duplicar |
| imágenes referenciadas (portada + cuerpo) | Supabase Storage bucket público `blog` | URLs reescritas en el contenido, ya no apuntan al WordPress |
| 6 páginas de contenido | `paginas/*.md` (crudo) | NO se insertan en la base — ver informe; esperan decisión de destino |

## Proceso en DOS pasos (reejecutable)

El corte de la Ola 5 apaga el WordPress. Por eso la migración se separa:

### Paso 1 — `harvest.py` (ejecutar MIENTRAS el WordPress esté vivo)

```bash
python -X utf8 harvest.py
```

Descarga de la API REST del WordPress y deja en disco, sin tocar la base:
- `wp-snapshot.json` — datos mínimos (posts, propuestas, categorías).
- `assets/<año>/<fichero>` — las imágenes referenciadas (contenido público).
- `assets/manifest.json` — mapa `{url_wp → ruta_relativa}`.

Estos ficheros hacen el paso 2 **independiente del WordPress**: se puede
reejecutar en la Ola 5 aunque el sitio ya esté apagado.

### Paso 2 — `load.py` (idempotente; se reejecuta contra la base que sea)

```bash
# SUPABASE_ENV apunta a un .env con SUPABASE_PUBLIC_URL y SERVICE_ROLE_KEY
# (NUNCA en el repo). Por defecto usa la ruta de scratchpad de desarrollo.
SUPABASE_ENV=/ruta/supabase.env python -X utf8 load.py

python -X utf8 load.py --verify   # solo re-verifica mojibake
```

1. Crea el bucket público `blog` (si falta) y sube las imágenes (idempotente,
   `x-upsert`).
2. Asegura las categorías nuevas sin duplicar las existentes.
3. `articles`: **delete-then-insert por slug**.
4. `proposals`: **delete-then-insert por título** (origin=official).
5. Reescribe todas las URLs de imagen a Storage.
6. Verifica **0 mojibake** en los tres patrones (`Ã` / `â‚¬` / `�`).

Reejecutarlo NO duplica nada y NO toca los artículos de prueba (fixtures), que
tienen otros slugs.

## Codificación (D-009 / D-014)

Todo el SQL se envía por `POST /pg/query` con el cuerpo **codificado en UTF-8
explícito** + `content-type: application/json; charset=utf-8` +
`content-length` en bytes. Tras cargar se verifican los tres patrones de
mojibake con `python -X utf8`. Ver `supabase/README.md`.

## Para la Ola 5 (base de producción limpia)

1. Asegurarse de tener `wp-snapshot.json` y `assets/` (del paso 1; si el
   WordPress sigue vivo, reejecutar `harvest.py`).
2. `SUPABASE_ENV=<env-produccion> python -X utf8 load.py`.
3. Confirmar el gate: conteos, 0 mojibake, una imagen accesible en Storage.

> `assets/` pesa ~29 MB (78 imágenes). Si no se versiona en el repo, hay que
> conservar la carpeta o reejecutar `harvest.py` antes del paso 2 en la Ola 5.
