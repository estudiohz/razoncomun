# 02 — Investigación técnica

> Fecha de la investigación: 30-10-2026. Lo marcado **[NO CONFIRMADO]** sale de
> fuentes secundarias o de conocimiento previo y debe comprobarse en vivo. Nota:
> desde la red de la sesión de investigación no se pudieron abrir
> `developers.facebook.com`, `contrataciondelestado.es`, `boe.es` ni
> `infosubvenciones.es`; el primer paso técnico de la fase es verificar las
> rutas marcadas (ver tarea T0.6 del plan).

## 1. Detección de reels nuevos

### 1.1 Instagram Graph API — Business Discovery (vía recomendada)

- **Qué es:** endpoint que devuelve los medios públicos de **otra** cuenta
  profesional (Business o Creator) a partir de su `username`.
- **Requisitos:**
  - Cuenta de Instagram profesional **propia** (Razón Común) vinculada a una
    página de Facebook.
  - App de Meta. Business Discovery solo existe en la **"Instagram API with
    Facebook Login"** (`graph.facebook.com`), no en la variante con Instagram
    Login.
  - Permisos: `instagram_basic` + `pages_read_engagement` (o
    `pages_show_list`). `business_management` solo si la página se gestiona
    desde un Business Manager.
  - **App Review:** para usar la app con la propia cuenta (rol de
    desarrollador/administrador en la app) basta el acceso estándar, sin
    revisión **[NO CONFIRMADO; comprobar en el panel de la app]**.
- **Llamada:**
  ```
  GET https://graph.facebook.com/v26.0/{ig-user-id}
    ?fields=business_discovery.username(elrastrodeldinero){
       media.limit(10){id,caption,timestamp,permalink,media_type,
                       media_product_type,media_url,thumbnail_url}}
    &access_token=...
  ```
- **Limitación clave (confirmada en la referencia de Meta):** `media_url` **se
  omite** en vídeos con audio con copyright o licencia (incluida música de la
  biblioteca de Instagram), en contenido marcado y cuando el dueño ha
  desactivado la descarga de reels. En lectura de media ajena esto es
  frecuente. Conclusión: **Business Discovery sirve para detectar (id,
  caption, fecha, permalink) pero no garantiza el vídeo.**
- **Webhooks para cuentas ajenas: no existen.** Detección por sondeo
  periódico (polling).
- **Rate limits:** datos contradictorios (200 × usuarios/hora según fuente
  secundaria; cuotas "Business Use Case" según Meta). Un sondeo cada 15–30
  min está muy por debajo de cualquier límite.
- **Versión:** Graph API **v26.0** (julio 2026); v25.0 vigente.
- **Token:** usar un token de página de larga duración (60 días) y renovarlo
  automáticamente; guardar en Dokploy, nunca en el repo.
- Docs: <https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/business_discovery>

### 1.2 Incrustación — oEmbed

- Para mostrar el reel en la ficha pública se usa el **oEmbed oficial** de
  Instagram (`GET /instagram_oembed?url=...`), que requiere el permiso/feature
  **oEmbed Read** y pasa por App Review (uso de plataforma, no de datos de
  usuario). Alternativa sin API: el `<blockquote class="instagram-media">` +
  `embed.js` que genera el propio Instagram desde "Insertar" (funciona sin
  token, pero carga JS de terceros: documentar en política de cookies).

### 1.3 Alternativas y por qué se descartan como vía principal

| Opción | Coste | Problema |
|---|---|---|
| Apify "Instagram Reel Scraper" | ~2,30 $/1000 resultados; < 1 €/mes aquí | Viola las condiciones de recogida automatizada de Meta; riesgo de bloqueo y reputacional para un partido. |
| `yt-dlp` sobre el permalink | 0 € | Mismo problema de condiciones; además se rompe con cambios de Instagram. |
| RSS.app y similares | **[NO CONFIRMADO]** | Mismo origen (scraping) con intermediario. |
| Acuerdo con el creador | 0 € | **La mejor vía:** el creador autoriza la app de Razón Común sobre su cuenta (webhooks + `media_url` siempre disponible) o envía el vídeo a un buzón. Ver decisión D-A03. |

**Decisión técnica:** detección por Business Discovery. Para el **vídeo**:
(1) `media_url` si viene; (2) si no, vídeo aportado por el creador (acuerdo);
(3) si no, subida manual del archivo por el auditor desde admin. La descarga
automatizada por terceros queda **fuera** del producto (ver 03, §3).

## 2. Obtención del contenido: transcripción y fotogramas

### 2.1 Claude / Anthropic API

Acepta texto, imágenes y PDF. **No acepta audio ni vídeo.** Por tanto:
transcribir primero, extraer fotogramas después, y enviar texto + imágenes.
Lo mismo aplica al resto de proveedores soportados por RC-Brain (OpenAI y
Google sí tienen modelos de audio, pero el pipeline debe ser agnóstico).

### 2.2 Transcripción (español)

| Opción | Precio orientativo | Notas |
|---|---|---|
| OpenAI `gpt-4o-mini-transcribe` | 0,003 $/min | Más barato. Sin timestamps. |
| OpenAI `gpt-4o-transcribe` | 0,006 $/min | Más preciso. |
| OpenAI `whisper-1` | 0,006 $/min | Único con timestamps/SRT; límite 25 MB. |
| Deepgram Nova-3 | 0,0043–0,0092 $/min | |
| AssemblyAI Universal | 0,15–0,21 $/h | |
| `faster-whisper` local (CPU, `small`/`medium` int8) | 0 € | Un reel de 1 min tarda de segundos a 1 min en CPU del VPS. Exige contenedor Python. |

**Decisión:** empezar con API externa (coste despreciable, cero mantenimiento;
proveedor elegido por variable de entorno, no acoplado al panel de IA). Dejar
`faster-whisper` como adaptador alternativo documentado si se quiere cero
dependencia externa. Ver D-A05.

### 2.3 Fotogramas y texto en pantalla

Los reels de esta cuenta muestran el importe, el NIF y el expediente **en
pantalla**, no siempre en el audio. Pipeline:

```bash
ffmpeg -i reel.mp4 -vn -ac 1 -ar 16000 audio.wav                 # audio
ffmpeg -i reel.mp4 -vf "select='gt(scene,0.3)',scale=768:-1" \
       -vsync vfr frames_%03d.jpg                                # 1 fotograma por cambio de escena
# fallback si hay pocos cambios de escena:
ffmpeg -i reel.mp4 -vf "fps=1/2,scale=768:-1" frames_%03d.jpg
```

Se envían al modelo de visión **caption + transcripción + 6–12 fotogramas**
con un prompt que exige JSON estricto y un `confidence` por campo. Tesseract
(`-l spa`) queda como pre-OCR opcional para abaratar.

## 3. Fuentes oficiales para el contraste

### 3.1 PLACSP — Plataforma de Contratación del Sector Público

- **No hay API de búsqueda** por expediente, NIF u órgano. El buscador web no
  tiene API documentada. Hay que **descargar e indexar en local**.
- **Feeds ATOM con extensiones CODICE** (XML, paginados hacia atrás por
  `<link rel="next">`), actualización continua:
  - Licitaciones de perfiles alojados (sin menores):
    `https://contrataciondelestado.es/sindicacion/sindicacion_643/licitacionesPerfilesContratanteCompleto3.atom` **[ruta NO CONFIRMADA]**
  - Contratos menores: `/sindicacion/sindicacion_1143/contratosMenoresPerfilesContratantes.atom`
  - Agregación de plataformas autonómicas (sin menores): `/sindicacion/sindicacion_1044/PlataformasAgregadasSinMenores.atom`
- **Histórico:** ZIP mensuales (y anuales para años cerrados) con los mismos
  ATOM. Permite cargar varios años atrás (los reels suelen citar contratos de
  meses o años anteriores).
- **Especificación del formato** (DGPE v1.3):
  <https://www.hacienda.gob.es/Documentacion/Publico/D.G.%20PATRIMONIO/Plataforma_Contratacion/especificacion-sindicacion-1-3.pdf>
- **Campos útiles del CODICE** (por entrada): `ContractFolderID` (expediente),
  `ContractingParty/Party/PartyName` (órgano), `TenderResult/WinningParty`
  (adjudicatario + `PartyIdentification/ID` = NIF), `AwardedTenderedProject/
  LegalMonetaryTotal/TaxExclusiveAmount` (importe), `TenderResult/AwardDate`,
  `ProcurementProject/TypeCode`, `ProcedureCode`, URL del perfil.
- **Proyectos de referencia:** `juanfont/codice` (Go, ZIP → CSV),
  <https://github.com/topics/placsp>.
- **Plataformas autonómicas:** Cataluña, Euskadi, Madrid, Andalucía, Galicia,
  Navarra y La Rioja tienen plataforma propia. Euskadi, Madrid y Galicia
  agregan a PLACSP (confirmado); resto **[NO CONFIRMADO]**. Lo seguro: **los
  contratos menores autonómicos/locales NO llegan a PLACSP** (el feed agregado
  es "sin menores"). El sistema debe marcar "revisar portal autonómico" cuando
  el órgano no sea estatal y el importe sea de menor (< 15.000 € servicios /
  < 40.000 € obras).
- **Volumen estimado:** cientos de miles de entradas/año entre los tres feeds.
  Postgres con índice `pg_trgm` sobre órgano y adjudicatario y B-tree sobre
  expediente y NIF es suficiente (ya tenemos `pgvector`; `pg_trgm` viene en la
  imagen de Supabase).

### 3.2 BOE — datos abiertos

- Sumario diario: `GET https://boe.es/datosabiertos/api/boe/sumario/AAAAMMDD`
  con `Accept: application/json` (o XML). Días sin boletín → 404.
  Doc: <https://boe.es/datosabiertos/documentos/APIsumarioBOE.pdf>
- La **sección V-A** (anuncios de licitación y formalización) viene como una
  sección más del sumario; cada ítem trae URL de XML/PDF/HTML.
- **No hay búsqueda de texto libre.** Se indexa el sumario diario en
  `boe_items` (tabla ya creada en 0015) y se busca en local. Para el texto
  completo de un anuncio se descarga su XML bajo demanda.
- También útil para resoluciones, subvenciones nominativas y nombramientos
  (sección III).

### 3.3 BDNS — Base de Datos Nacional de Subvenciones

- API REST pública sin registro, JSON. Swagger:
  <https://www.infosubvenciones.es/bdnstrans/doc/swagger>
- Endpoints de convocatorias y **concesiones**; filtro por beneficiario/NIF
  **[nombre del parámetro NO CONFIRMADO; mirar Swagger]**.
- Las concesiones a personas físicas solo se publican el año de concesión y el
  siguiente.
- Se consulta **en vivo** (no se indexa): solo cuando el caso es una
  subvención, no un contrato.

### 3.4 BORME y empresas

- API gratuita del BOE: `https://boe.es/datosabiertos/api/borme/sumario/AAAAMMDD`
  (doc: APIsumarioBORME.pdf). Sección A en PDF; la librería Python
  `bormeparser` los parsea.
- Servicios: LibreBOR (API limitada, precio **[NO CONFIRMADO]**), APIEmpresas
  (100 consultas gratis), eInforma/Axesor (de pago).
- **Uso en esta fase:** solo para enriquecer la ficha con "constituida en…,
  administrador…" a partir del NIF, **bajo demanda y con revisión humana**.
  No se automatiza en el MVP (riesgo de datos de personas físicas, ver 03 §4).

### 3.5 Otras fuentes y referentes

- Tribunal de Cuentas (<https://www.tcu.es>), Portal de Transparencia
  (<https://transparencia.gob.es>), datos.gob.es, contratos menores de Hacienda.
- **Civio** — "¿Quién cobra la obra?" y "El BOE nuestro de cada día":
  referente metodológico y de tono (separar dato de opinión, enlazar siempre).
  Citar en la página de metodología.

## 4. Estrategia de coincidencia (matching)

Orden de búsqueda sobre el índice local, con puntuación acumulada:

| Señal | Peso | Cómo |
|---|---|---|
| Expediente exacto | 1,00 | Normalizado (sin espacios, mayúsculas, guiones unificados). Es la señal definitiva. |
| NIF del adjudicatario + importe ±2 % | 0,90 | |
| NIF del adjudicatario + órgano (trigram ≥ 0,6) | 0,75 | |
| Órgano (trigram) + importe ±2 % + fecha ±90 días | 0,60 | |
| Adjudicatario (trigram ≥ 0,7) + importe ±5 % | 0,50 | |

Resultado por caso: **coincide** (≥ 0,9), **parcial** (0,5–0,9, lista de
candidatos), **no encontrado** (< 0,5), **desmentido** (encontrado pero con
importe/adjudicatario distintos a lo denunciado — se muestra la discrepancia).
Importe denunciado vs. importe oficial: el contador **siempre** usa el oficial.

## 5. Costes operativos (2 reels/día, ~1 min)

| Concepto | Mensual |
|---|---|
| API de Meta (Business Discovery, oEmbed) | 0 € |
| Transcripción (API) | < 0,50 € |
| Modelo de visión + extracción (6–12 fotogramas + texto por reel) | 2–10 € según modelo **[estimación]** |
| Índice PLACSP/BOE (CPU + disco en el VPS, ~2–5 GB/año) | 0 € marginal |
| **Total** | **< 15 €/mes** |

## 6. Pendientes de verificación en vivo (bloqueantes de la fase 1)

1. Rutas exactas de los tres feeds ATOM de PLACSP y estructura CODICE actual.
2. Que el sumario del BOE devuelve la sección V-A con los campos esperados.
3. Parámetros de la API de BDNS para filtrar concesiones por NIF.
4. Que la app de Meta en modo desarrollo permite Business Discovery sin App
   Review con la cuenta propia.
5. Qué devuelve `media_url` para 10 reels reales de `@elrastrodeldinero`
   (porcentaje con música).
