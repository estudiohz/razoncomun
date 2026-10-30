# 05 — Plan de proyecto

## 1. Estrategia

Entregar **de dentro afuera**: primero el dato y la verificación (lo difícil y
lo que da valor legal), luego lo visible, luego la IA, y al final el "tiempo
real". Cada fase deja algo usable y desplegable en `dev` por sí sola. La
detección automática es la **última** pieza porque depende de terceros (Meta,
creador) y es la que menos valor añade si lo anterior no está sólido.

Unidad de estimación: **sesión de agente** (una ejecución de Claude Code con
un brief del doc 06, ~2–4 h de trabajo efectivo incluyendo pruebas). Las
sesiones de un mismo agente son secuenciales; agentes distintos pueden correr
en paralelo cuando no comparten archivos.

## 2. Fases

### Fase 0 — Prerrequisitos y verificación (sin código de producto)

| # | Tarea | Dueño | Bloquea |
|---|---|---|---|
| T0.1 | Crear/confirmar cuenta profesional de Instagram de RC vinculada a página de Facebook; crear app de Meta; obtener token de página de larga duración; probar Business Discovery con la cuenta objetivo y anotar % de reels con `media_url` | Sergio + rc-10 | F4 |
| T0.2 | Contactar con `@elrastrodeldinero`: explicar el proyecto, proponer acuerdo (licencia de embed+cita, aporte de vídeos o autorización de cuenta). Documentar respuesta | Sergio | F4 (vía preferente) |
| T0.3 | Enviar doc 03 al abogado y al DPD; abrir EIPD y registro de actividades; contrato de encargado con proveedores de IA/transcripción | Sergio | Lanzamiento público |
| T0.4 | Decidir D-A01…D-A10 (doc 07) | Sergio + orquestador | F1 |
| T0.5 | Elegir 5 reels reales ya publicados y contrastarlos **a mano** (expediente, URL oficial, importe): serán los fixtures de pruebas de todo el pipeline | Sergio + rc-13 | F1 |
| T0.6 | Verificación en vivo de rutas y formatos marcados [NO CONFIRMADO] en doc 02 §6 (feeds ATOM, BOE V-A, BDNS, oEmbed) | rc-09 | F1 |
| T0.7 | Habilitar en infra: buckets `vigia` y `vigia-pruebas`, secretos vacíos en Dokploy, extensión `pg_trgm` | rc-01 | F1 |

**Salida:** decisiones cerradas, fixtures, accesos, feeds confirmados.
**Duración:** 1 semana de calendario (depende de terceros).

### Fase 1 — Datos, fuentes y verificación manual (MVP interno)

| # | Entrega | Agente | Sesiones |
|---|---|---|---|
| T1.1 | Migración 0068 completa (doc 04 §3), seed rol `auditor`, `is_auditor()`, triggers de invariantes, `watchdog_totals()`; smoke RLS | rc-02-datos | 2 |
| T1.2 | `lib/vigia/fuentes`: parser ATOM/CODICE, carga histórica reanudable, job diario, índice BOE V-A en `boe_items`, cliente BDNS, `matchCandidates()` con tests sobre fixtures T0.5, snapshot + sha256 de documentos | rc-09-vigia-fuentes | 4 |
| T1.3 | `/admin/auditoria`: lista/cola con filtros por estado, ficha con formulario completo (hechos/valoración, pruebas, réplica), alta manual por formulario, transiciones con `registrarAuditoria`, checklist M5 | rc-11-vigia-admin | 3 |
| T1.4 | Despliegue del contenedor `vigia` en Dokploy (solo job de fuentes por ahora), cron diario, documentación en GUIA-DOKPLOY | rc-01-infra | 1 |
| T1.5 | Pruebas: Vitest de transiciones y matching, RLS matrix, E2E admin básico | rc-13-vigia-qa | 1 |

**Criterio de aceptación:** un auditor crea un caso a mano desde admin con los
datos de un reel, pulsa "Buscar en fuentes", obtiene candidatos de PLACSP/BOE
con enlace y snapshot, selecciona uno, rellena hechos y valoración, y lo deja
en `verified`. Los 5 fixtures de T0.5 encuentran su expediente (≥ 4 de 5 con
score ≥ 0,9).
**Duración:** 2 semanas.

### Fase 2 — Sección pública

| # | Entrega | Agente | Sesiones |
|---|---|---|---|
| T2.1 | `/auditoria` (contador, lista, filtros, RSS/JSON), `/auditoria/[slug]` (ReelEmbed oEmbed, hechos/valoración, pruebas, firma del revisor, aviso IA, historial), `/auditoria/metodologia` (criterios, responsable editorial, IA), OG image | rc-12-vigia-publico | 3 |
| T2.2 | Formulario de rectificación → `watchdog_corrections` + bandeja en admin + flujo de rectificación con versión | rc-12 + rc-11 | 2 |
| T2.3 | Publicación programada (`published_at`), `revalidatePath`, sitemap | rc-12 | incl. |
| T2.4 | E2E público (@publico, @visual móvil/escritorio), accesibilidad básica, comprobación de que nada no-publicado se filtra (RLS + UI) | rc-13 | 1 |
| T2.5 | Revisión legal de las 5 primeras fichas antes de abrir en producción | Sergio + abogado | — |

**Criterio de aceptación:** las 5 fichas fixture se ven en `dev` con todas las
medidas M1–M9 verificables en pantalla; una solicitud de rectificación llega a
admin y, resuelta, muestra la nota pública y la versión anterior.
**Duración:** 1,5 semanas.

### Fase 3 — Análisis con IA (por URL, manual)

| # | Entrega | Agente | Sesiones |
|---|---|---|---|
| T3.1 | Adaptadores de brain con soporte de imágenes (anthropic, openai, google), `POST /vigia/extract`, prompt en `constitution.mjs`, validación JSON, lista de términos de riesgo, tests con fixtures | rc-08-brain | 2 |
| T3.2 | Worker: `POST /process-url` + subida manual de vídeo, ffmpeg (audio/fotogramas), adaptador de transcripción (API; interfaz para faster-whisper), persistencia en `watchdog_sources`, llamada a extract, llamada a matching, creación de `watchdog_alerts(analyzed)` + evidence | rc-10-vigia-ingesta | 3 |
| T3.3 | Admin: botón "Analizar URL", vista de la extracción con confidences y fotogramas, "reanalizar" | rc-11 | 1 |
| T3.4 | Infra: imagen del worker con ffmpeg, secretos de transcripción, healthcheck | rc-01 | 1 |
| T3.5 | Pruebas de pipeline con los 5 fixtures: extracción correcta en ≥ 4 campos clave de 5 por reel | rc-13 | 1 |

**Criterio de aceptación:** pegar la URL de un reel (y subir el vídeo si hace
falta) produce en < 3 min un caso `analyzed` con extracción, candidatos y
resumen neutro listo para revisar.
**Duración:** 1,5 semanas.

### Fase 4 — Detección automática ("tiempo real")

| # | Entrega | Agente | Sesiones |
|---|---|---|---|
| T4.1 | Sondeo Business Discovery, deduplicación, renovación del token, manejo de `media_url` ausente (buzón del creador / marcar "pendiente de vídeo") | rc-10 | 2 |
| T4.2 | `POST /api/vigia/notify` → Discord + push a auditores; whitelist middleware | rc-11 | 1 |
| T4.3 | Página de ajustes en admin: cuentas vigiladas, intervalo, pausa electoral (`AUDITORIA_PAUSA`) | rc-11 | 1 |
| T4.4 | Infra: worker en marcha continua, alertas si falla el token | rc-01 | 1 |
| T4.5 | E2E: simulación con feed fixture → aviso → caso en cola | rc-13 | 1 |

**Criterio de aceptación:** un reel nuevo real aparece en la cola con aviso en
Discord en < 30 min, con análisis y candidatos.
**Duración:** 1 semana.

### Fase 5 — Lanzamiento y difusión

- Merge a `main`, migraciones en producción, despliegue manual (RAMAS.md).
- Comunicación: artículo en el blog (`source_type='observatorio'`), post en
  redes (manual; la autopublicación va con `redes-autopublicacion.json` en
  otra fase).
- Formación de 30 min a los auditores (art. 4 AI Act) con la guía de estilo.
- Revisión post-lanzamiento a 2 y 6 semanas: KPIs del doc 01.

## 3. Calendario orientativo

```
Semana 1   F0 ████████
Semana 2-3 F1      ████████████████     (rc-02 → rc-09 ∥ rc-11 → rc-01 → rc-13)
Semana 4   F2                      ████████
Semana 5-6 F3                              ████████████   (rc-08 ∥ rc-10 → rc-11)
Semana 7   F4                                          ████████
Semana 8   F5                                                  ████
```

Total: **~8 semanas**, ~38 sesiones de agente. F2 y F3 pueden solaparse (no
comparten archivos). Si T0.1/T0.2 se retrasan, F4 se pospone sin bloquear nada.

## 4. Dependencias críticas

| Dependencia | Riesgo si falta | Mitigación |
|---|---|---|
| Cuenta IG profesional + app Meta | Sin detección automática | F1–F3 funcionan con alta manual |
| Acuerdo con el creador | Sin vídeo en reels con música | Subida manual desde admin; oEmbed sigue funcionando |
| Feeds PLACSP accesibles y estables | Sin contraste automático | Carga histórica por ZIP; búsqueda manual con enlace |
| Proveedor de IA con visión | Extracción solo de audio | Los 3 proveedores soportados tienen visión |
| Abogado/DPD | Lanzamiento público bloqueado | Todo F1–F4 puede probarse en `dev` (cerrado) |

## 5. Riesgos

| Riesgo | Prob. | Impacto | Respuesta |
|---|---|---|---|
| Ficha publicada con error de hecho → reclamación | Media | Alto | M1–M7; réplica previa; rectificación en 3 días; fixtures revisados por abogado |
| Meta cambia Business Discovery o revoca la app | Media | Medio | Alta manual siempre disponible; acuerdo con el creador como vía 2 |
| PLACSP cambia el formato ATOM | Baja | Medio | Parser con tests de fixtures; alerta si 0 entradas en 48 h |
| Inyección de prompt vía caption/transcripción | Media | Medio | `injectionGuard`, salida JSON validada, nunca ejecuta acciones |
| El contador se usa en campaña como propaganda sin matices | Alta | Medio | Nombre y metodología fijos; pausa electoral; texto legal en pie |
| Volumen de casos supera la capacidad de revisión | Media | Bajo | Cola con prioridad por importe; nada se publica solo |
| Coste del modelo de visión se dispara | Baja | Bajo | ≤ 12 fotogramas, 768 px; tope mensual configurable |
| Datos de personas físicas en fichas | Media | Alto | `es_persona_fisica` fuerza plantilla minimizada; revisión obligatoria |

## 6. Presupuesto

| Concepto | Una vez | Mensual |
|---|---|---|
| Desarrollo (38 sesiones de agente) | según coste de sesión | — |
| Revisión legal (doc 03 + 5 fichas + acuerdo creador) | honorarios | — |
| APIs (Meta, transcripción, visión) | — | < 15 € |
| VPS (disco +5 GB para índices y pruebas) | — | ~0–5 € |

## 7. Definición de hecho (global)

- Código en `dev` desplegado y probado contra la BD real de dev.
- Migración aplicada en dev; `scripts/smoke` en verde; Vitest y E2E en verde.
- Documentación actualizada: este directorio, `infra/GUIA-DOKPLOY.md`,
  `supabase/README.md`, `*.env.example` del worker.
- Cero secretos en el repo (revisión del diff antes de cada push).
- Checklist M1–M12 revisado por el orquestador antes del merge a `main`.
