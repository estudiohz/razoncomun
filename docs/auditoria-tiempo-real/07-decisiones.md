# 07 — Registro de decisiones

Formato: **D-Axx** · estado (`CERRADA` / `PENDIENTE` / `PROPUESTA`) · fecha ·
quién decide. Las pendientes bloquean la fase indicada. Una decisión cerrada
no se reabre sin una entrada nueva que la sustituya.

## Cerradas (por la investigación; Sergio puede revocarlas)

### D-A01 · CERRADA · 30-10-2026 (confirmada por Sergio) · Se reutiliza el esquema "Vigía del BOE" (0015)
`watchdog_alerts` y `boe_items` ya existen con la regla "humano verifica y
firma siempre". La migración 0068 los **extiende**; no se crean tablas
paralelas. Motivo: coherencia con `vision-plataforma.md` y menos deuda.

### D-A02 · CERRADA · 30-10-2026 · Nada de scraping ni de resubir vídeos
Detección solo por Graph API (Business Discovery); vídeo solo por `media_url`,
aporte del creador o subida manual del auditor; incrustación por oEmbed.
Apify/yt-dlp quedan **fuera del producto**. Motivo: doc 03 §2–3 (condiciones de
Meta, TRLPI, reputación de un partido). Coste de la renuncia: parte de los
reels (los que llevan música) exigirán subir el vídeo a mano.

### D-A04 · CERRADA · 30-10-2026 · Lógica en un worker propio, no en n8n
`lib/vigia/worker` (Node sin deps, mismo patrón que brain-service). n8n podrá
dispararlo cuando se cierre I2. Motivo: I2 abierta, workflows de `n8n/` nunca
ejecutados, código versionado y testeable.

### D-A07 · CERRADA · 30-10-2026 · La extracción IA vive en RC-Brain
Nuevo endpoint `POST /vigia/extract`; adaptadores ampliados a imágenes.
Motivo: proveedor configurable, guardrail, auditoría y suite de neutralidad ya
existen.

### D-A09 · CERRADA · 30-10-2026 (nombre fijado por Sergio) · El contador suma solo el importe oficial
`importe_oficial_cents` de fichas `published`, no rectificadas, con
`verificacion in ('coincide','parcial')`. Nombre público: **"Gasto público
señalado"**, con subtítulo fijo *"verificado contra fuentes oficiales"* y
enlace a la metodología. "Señalado" describe lo que hace la sección (señalar)
sin presentar una valoración como cifra; el subtítulo aporta la diligencia
exigible (doc 03 §1).

### D-A10 · CERRADA · 30-10-2026 · Réplica previa y rectificación por diseño
Aunque la LO 2/1984 pueda no aplicar a un partido, se implementa (M6, M7).
Motivo: diligencia exigible (STC 6/1988) y proyecto de ley en curso.

### D-A15 · CERRADA · 30-10-2026 · Sergio · Telegram como vía de entrada de vídeos
Los auditores (y, si acepta, el creador) pueden **enviar el reel o su enlace
por Telegram**. Ya existe un bot de Telegram del equipo que recibe enlaces
para las propuestas (vive fuera de este repo: n8n o servicio aparte). El
worker expone `POST /ingest/telegram` y además puede sondear la Bot API
(`getUpdates`, sin webhook ni dependencias) si se le da un token propio. Ver
doc 04 §4.6. Esta vía es la **principal** para los reels con música (sin
`media_url`) y para arrancar antes de tener la app de Meta aprobada.

### D-A16 · CERRADA · 30-10-2026 · Sergio · Varias cuentas vigiladas desde el diseño
Tabla `watchdog_accounts` (plataforma, handle, activa, intervalo, notas,
acuerdo firmado sí/no) gestionada desde admin. `@elrastrodeldinero` es la
primera fila. `watchdog_sources.account` referencia esa tabla. Cada cuenta
nueva exige acuerdo o al menos aviso al creador (doc 03 §2) antes de activarla.

## Pendientes (bloquean F0/F1)

### D-A03 · CERRADA · 30-10-2026 · Sergio · Se pedirá permiso y colaboración a `@elrastrodeldinero`
Opción (b): acuerdo de licencia (embed + cita + resumen) y aporte de vídeos
sin contraprestación. Es **donación en especie** (LO 8/2007 art. 4.2):
documentarla, valorarla y que el abogado revise el texto. Hasta que haya
respuesta, el producto funciona con alta manual y vídeos por Telegram (D-A15).
Pendiente operativo: T0.2 del plan (contacto y acuerdo escrito).

### D-A05 · PENDIENTE · Sergio · Proveedor de transcripción
(a) API externa (OpenAI `gpt-4o-mini-transcribe`, ~0,003 $/min; contrato de
encargado RGPD necesario); (b) `faster-whisper` local (0 €, contenedor
Python, CPU del VPS). **Recomendación: (a)** para arrancar, (b) documentado
como alternativa. Bloquea: F3.

### D-A06 · PENDIENTE · Sergio · Quién revisa: rol `auditor` nuevo
Propuesta: `app_role = 'auditor'` (ortogonal a cargos) + `is_auditor()`; los
`moderator` actuales **no** son auditores por defecto. Alternativa: reutilizar
`is_moderator()` (ya en 0015). **Recomendación: rol nuevo**, porque revisar
gasto público no es moderar comunidad y conviene limitar quién firma. Bloquea:
F1 (migración).

### D-A08 · PENDIENTE · orquestador · Cómo se sirve el snapshot oficial al público
(a) URL firmada de corta duración desde el bucket privado en cada carga de
ficha; (b) copia a bucket público al publicar. **Recomendación: (a)** (menos
superficie; el enlace oficial sigue siendo el principal). Bloquea: F2.

### D-A11 · PENDIENTE · Sergio · Responsable editorial público
Nombre que figurará en `/auditoria/metodologia` y responde rectificaciones
(AI Act art. 50.4; LO 2/1984). Bloquea: F2.

### D-A12 · PENDIENTE · Sergio · Texto de navegación y nombre de la sección
Propuesta: "Auditoría" en el menú principal, título "Auditoría del gasto
público", URL `/auditoria`. Bloquea: F2.

### D-A13 · PENDIENTE · Sergio · Umbral de réplica previa
¿A partir de qué importe o en qué casos es obligatoria (no solo recomendada)
la solicitud de réplica antes de publicar? Propuesta: siempre que se nombre
una empresa adjudicataria o una persona física; opcional si solo se nombra el
órgano. Bloquea: F1 (regla en el formulario de aprobación).

### D-A14 · PROPUESTA · orquestador · Más fuentes de entrada en el futuro
`watchdog_sources.kind` ya admite `manual_form` y está preparado para otras
cuentas. Se propone **no** añadir denuncias de afiliados en esta fase (riesgo
RGPD y de moderación). Revisar tras 2 meses de operación.

### D-A17 · PENDIENTE · Sergio · Dónde vive el bot de Telegram actual
¿Es un workflow de n8n (instancia de la agencia) o un servicio propio? Si es
n8n, se añade un nodo que reenvíe al worker (`POST /ingest/telegram`); si es
un servicio propio, se le añade el comando `/auditoria`. Si no conviene
tocarlo, el worker usa un bot nuevo propio (`VIGIA_TELEGRAM_BOT_TOKEN`).
Bloquea: F3 (vía Telegram).

## Preguntas abiertas de investigación (no bloquean, se cierran en T0.6)

- Rutas exactas de los feeds ATOM de PLACSP y si el agregado autonómico cubre
  Cataluña, Andalucía y Navarra.
- Parámetro de BDNS para concesiones por NIF.
- Si Business Discovery funciona en modo desarrollo sin App Review con la
  cuenta propia; porcentaje real de reels con `media_url`.
- Estado del proyecto de LO de rectificación (121/000083) y texto final del
  Omnibus sobre el art. 50.
