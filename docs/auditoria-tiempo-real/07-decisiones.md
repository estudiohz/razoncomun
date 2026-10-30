# 07 — Registro de decisiones

Formato: **D-Axx** · estado (`CERRADA` / `PENDIENTE` / `PROPUESTA`) · fecha ·
quién decide. Las pendientes bloquean la fase indicada. Una decisión cerrada
no se reabre sin una entrada nueva que la sustituya.

## Cerradas (por la investigación; Sergio puede revocarlas)

### D-A01 · CERRADA · 30-10-2026 · Se reutiliza el esquema "Vigía del BOE" (0015)
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

### D-A09 · CERRADA · 30-10-2026 · El contador suma solo el importe oficial
`importe_oficial_cents` de fichas `published`, no rectificadas, con
`verificacion in ('coincide','parcial')`. Nombre público: **"Gasto público
cuestionado y verificado"**. Motivo: doc 03 §1 (cifra presentada como hecho).

### D-A10 · CERRADA · 30-10-2026 · Réplica previa y rectificación por diseño
Aunque la LO 2/1984 pueda no aplicar a un partido, se implementa (M6, M7).
Motivo: diligencia exigible (STC 6/1988) y proyecto de ley en curso.

## Pendientes (bloquean F0/F1)

### D-A03 · PENDIENTE · Sergio · Relación con `@elrastrodeldinero`
Opciones: (a) sin contacto, solo embed + cita (lícito pero frágil para el
vídeo); (b) acuerdo de licencia y aporte de vídeos sin contraprestación
(**donación en especie**: documentar y valorar, LO 8/2007 art. 4.2); (c) con
contraprestación (contrato, etiquetado Reglamento 2024/900). **Recomendación:
(b)**, con revisión del abogado. Bloquea: F4 (vía preferente de vídeo).

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

## Preguntas abiertas de investigación (no bloquean, se cierran en T0.6)

- Rutas exactas de los feeds ATOM de PLACSP y si el agregado autonómico cubre
  Cataluña, Andalucía y Navarra.
- Parámetro de BDNS para concesiones por NIF.
- Si Business Discovery funciona en modo desarrollo sin App Review con la
  cuenta propia; porcentaje real de reels con `media_url`.
- Estado del proyecto de LO de rectificación (121/000083) y texto final del
  Omnibus sobre el art. 50.
