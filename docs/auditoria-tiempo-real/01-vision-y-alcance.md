# 01 — Visión y alcance

## Problema

Hay denuncias públicas bien documentadas de gasto público cuestionable (la
cuenta `@elrastrodeldinero` publica reels con organismo, empresa, importe y
muchas veces el número de expediente en pantalla) pero:

- se pierden en el feed a las 48 h;
- nadie las contrasta de forma sistemática contra la fuente oficial;
- no existe un acumulado consultable que muestre la magnitud.

Razón Común quiere convertir esas denuncias en **fichas verificadas, con
prueba oficial y acumulado público**, como demostración práctica de su
discurso de transparencia y control del gasto.

## Objetivo de la fase

Al cerrar la fase, un visitante de `razoncomun.com/auditoria` debe poder:

1. Ver un **contador** de gasto cuestionado verificado (importe acumulado y
   número de casos), con enlace a la **metodología**.
2. Recorrer la **lista de fichas**, filtrar por organismo, año, categoría y
   nivel de verificación.
3. Abrir una **ficha** y ver: el reel original incrustado, los **hechos
   verificados** (expediente, órgano, adjudicatario, importe, fecha, enlace
   oficial, copia sellada), la **valoración** de Razón Común claramente
   separada, el aviso de uso de IA, quién revisó y cuándo, y el formulario de
   rectificación.

Y el equipo debe poder:

4. Recibir un **aviso** cuando aparece un reel nuevo (Discord/push) con el
   análisis ya hecho y los candidatos oficiales encontrados.
5. Desde `/admin/auditoria`, **revisar, corregir, aprobar o descartar** cada
   caso en menos de 10 minutos, y añadir casos a mano (pegar una URL de reel o
   rellenar los datos directamente).

## Alcance (IN)

| Bloque | Incluido |
|---|---|
| Fuentes de entrada | `@elrastrodeldinero` por API oficial de Meta; alta manual por URL o formulario. Diseño preparado para más cuentas y para denuncias de afiliados (no se implementan). |
| Análisis IA | Transcripción del audio, lectura de fotogramas (texto en pantalla), extracción a JSON estructurado con nivel de confianza por campo, resumen propio. |
| Contraste | Índice propio de PLACSP (alojados + menores + agregados autonómicos), BOE sección V-A, BDNS en vivo, BORME para identificar la empresa. Coincidencia por expediente, NIF, órgano, importe y fecha. |
| Revisión | Cola en admin, rol `auditor`, estados, trazabilidad en `audit_log`, derecho de réplica previo (campo + plazo). |
| Publicación | Sección pública, ficha, contador, metodología, RSS/JSON, OG image, rectificación, historial de versiones. |
| Notificaciones | Discord (canal de equipo) y push a auditores. |
| Pruebas | Unitarias (Vitest), RLS (smoke Python), E2E (Playwright), fixtures con 5 reels reales ya contrastados a mano. |

## Fuera de alcance (OUT) — explícitamente

- Scraping de Instagram con sesión, descarga masiva o cualquier método que
  viole las condiciones de Meta.
- Publicación automática sin revisión humana. **Nunca.**
- Dossier PDF generado automáticamente (queda `dossier_url` para adjuntarlo a
  mano si se hace).
- Difusión automática en redes de cada ficha (va a la fase siguiente, sobre
  `n8n/redes-autopublicacion.json`).
- Contratos autonómicos menores no agregados a PLACSP: se **señalan** como
  "requiere revisión en portal autonómico", no se indexan los portales.
- Verificación del NIF contra la AEAT (exige certificado digital).
- Módulo "España en Directo" (`econ_indicators`, misma migración 0015): otra
  fase.

## Criterios de éxito (medibles)

| KPI | Objetivo a 3 meses del lanzamiento |
|---|---|
| Tiempo desde publicación del reel hasta aviso al equipo | < 30 min (p95) |
| Casos con al menos un candidato oficial encontrado automáticamente | ≥ 60 % |
| Tiempo medio de revisión humana por caso | < 10 min |
| Fichas publicadas con prueba oficial enlazada y copia sellada | 100 % |
| Solicitudes de rectificación atendidas en plazo (3 días) | 100 % |
| Falsos positivos publicados (ficha retirada por error de hecho) | 0 |
| Coste operativo mensual (APIs + IA) | < 20 € |

## Usuarios y roles

| Rol | Quién | Qué hace |
|---|---|---|
| Visitante | Público | Lee fichas y contador; puede pedir rectificación. |
| Auditor | Afiliados de confianza con `app_role = 'auditor'` | Revisa la cola, edita, aprueba o descarta. Firma la ficha. |
| Admin | Sergio y equipo | Todo lo anterior + ajustes (cuentas vigiladas, umbrales), rectificaciones. |
| Responsable editorial | Persona designada (nombre público) | Figura en la página de transparencia; responde rectificaciones. |
| Sistema (`service_role`) | Worker de ingesta, RC-Brain, indexador de fuentes | Escribe candidatos, pruebas y análisis. Nunca publica. |

## Supuestos

- Razón Común dispone (o puede disponer en días) de una cuenta profesional de
  Instagram vinculada a una página de Facebook. Si no, la detección arranca con
  alta manual por URL (fase 3 antes que fase 4).
- El proveedor de IA activo en el panel admin tendrá capacidad de visión
  (Anthropic, OpenAI y Google la tienen).
- Hay presupuesto para ~15 €/mes de APIs.
- Un abogado revisará el documento 03 y la primera tanda de fichas antes del
  lanzamiento público.
