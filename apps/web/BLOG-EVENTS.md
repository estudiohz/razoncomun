# Contrato del evento de publicación — blog / observatorio

Emisor: **rc-05-blog** (`apps/web/src/lib/blog/eventos.ts`).
Consumidor: **rc-08** (workflow n8n de autopublicación en redes).

Este documento es el contrato. Si cambia el payload, cambia `version` y se avisa a rc-08.

---

## 1. Cuándo se emite

Exactamente en la transición `draft → published` de una fila de `public.articles`,
desde la server action `guardarArticulo`. **No** se emite:

- al editar un artículo que ya estaba publicado (evita republicar en redes en cada corrección);
- al guardar un borrador;
- al despublicar.

El disparo es *best effort*: si n8n no responde, el artículo **se publica igualmente** y
el editor ve un aviso en el panel. Ver "Limitación conocida" al final.

## 2. Transporte

```
POST  $N8N_BLOG_WEBHOOK_URL
Content-Type: application/json; charset=utf-8
X-RC-Evento: articulo.publicado
X-RC-Firma:  <hex HMAC-SHA256 del cuerpo exacto, clave = $N8N_BLOG_WEBHOOK_SECRET>
```

Timeout de 5 s. Cualquier respuesta no-2xx se considera no entregada.

### Verificación de la firma (lado rc-08)

Firmar el **cuerpo crudo tal cual llega**, no el JSON reserializado — el orden de claves
importa. En Node:

```js
crypto.createHmac('sha256', SECRETO).update(cuerpoCrudo, 'utf8').digest('hex')
```

y comparar en tiempo constante. `verificarFirma()` de `eventos.ts` es la implementación
de referencia; rc-08 debe replicar ese comportamiento exacto.

## 3. Variables de entorno

| Variable | Dónde | Descripción |
|---|---|---|
| `N8N_BLOG_WEBHOOK_URL` | webapp | URL del webhook de n8n. Sin ella el evento solo se registra en el log. |
| `N8N_BLOG_WEBHOOK_SECRET` | webapp + n8n | Secreto compartido del HMAC. |

## 4. Payload

```jsonc
{
  "version": "1",
  "evento": "articulo.publicado",
  "emitido_en": "2026-07-20T11:42:03.114Z",   // ISO-8601 UTC
  "articulo": {
    "id": "9f1c…",                             // uuid de public.articles
    "slug": "vivienda-ejemplo-analisis-licencias",
    "url": "https://www.razoncomun.com/blog/vivienda-ejemplo-analisis-licencias",
    "titulo": "…",
    "extracto": "…",                           // puede ser null
    "imagen": "https://…",                     // portada; puede ser null
    "categoria": {                             // puede ser null
      "slug": "vivienda",
      "nombre": "Vivienda",
      "color": "#E8792F"
    },
    "tipo": "editorial",                       // "editorial" | "observatorio"
    "publicado_en": "2026-07-20T09:00:00Z",    // puede ser null
    "fuentes": ["https://…", "https://…"],     // >= 1 garantizado (ver nota)
    "elaborado_con_ia": false,
    "revisado_por": "Redacción de Razón Común" // puede ser null
  }
}
```

### Garantías para rc-08

- `fuentes` tiene **al menos un elemento**: publicar sin fuentes está bloqueado en
  `guardarArticulo`. El sello de trazabilidad es marca de la casa y rc-08 puede
  citarlas en el post sin comprobar si el array está vacío.
- `url` es absoluta y ya apunta a `/blog/…` o `/observatorio/…` según `tipo`.
- `id` + `slug` son estables e idempotentes: si por reintento llegara el mismo evento
  dos veces, rc-08 debe deduplicar por `id`.

### Campos que pueden ser `null`

`extracto`, `imagen`, `categoria`, `publicado_en`, `revisado_por`. rc-08 debe tolerarlos.

## 5. Deuda conocida (para rc-02 y rc-08)

**No hay tabla de outbox.** El esquema `0010_blog.sql` no la contempla, así que la entrega
es de tipo *como mucho una vez*: si n8n está caído en el instante de publicar, el evento se
pierde (queda en el log del servidor con el JSON completo, recuperable a mano).

Propuesta pendiente de aprobación: una tabla `content_outbox (id, evento, payload jsonb,
intentos, entregado_en, creado_en)` y que `guardarArticulo` inserte en ella dentro de la
misma transacción; un worker o el propio n8n haría el drenado con reintentos. **El payload
de arriba no cambiaría** — solo el mecanismo de entrega. Por eso rc-08 puede implementar
ya contra este contrato.

## 6. Deuda del sello de trazabilidad

`elaborado_con_ia` y `revisado_por` **no son columnas del esquema**; se derivan
(`lib/blog/tipos.ts`):

- `elaborado_con_ia` = `source_type === 'observatorio'`
- `revisado_por` = `display_name` del autor

Si rc-02 añade columnas explícitas `ai_generated` / `reviewed_by`, estos campos pasarán a
leerse directamente y el contrato **no cambia**.
