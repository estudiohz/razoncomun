# 03 — Marco legal y medidas de cumplimiento

> **No es asesoramiento jurídico.** Es el análisis de riesgos que orienta el
> diseño. Lo marcado ⚖️ debe validarlo un abogado antes del lanzamiento público;
> lo de protección de datos, el DPD del partido. Fecha: 30-10-2026.

## 1. Honor y difamación

- **LO 1/1982** (protección civil del honor): art. 7.7, es intromisión
  ilegítima imputar hechos o emitir juicios de valor que lesionen la dignidad.
  Art. 9: cese, indemnización y publicación de la sentencia. **Las empresas
  también tienen derecho al honor** (STC 139/1995) — y las adjudicatarias son
  el sujeto más expuesto en este producto.
- **Código Penal:** calumnia (art. 205: imputar un delito con conocimiento de
  su falsedad o temerario desprecio a la verdad), injuria (208), *exceptio
  veritatis* (207, 210), agravante de publicidad (211), responsabilidad civil
  solidaria del medio (212).
- **Doctrina constitucional:** la veracidad no exige exactitud sino
  **diligencia razonable en la comprobación** (STC 6/1988, 139/2007). Pesan a
  favor el interés público y que el afectado sea cargo público. El "reportaje
  neutral" (STC 76/2002) se pierde si el partido **hace suyas** las
  afirmaciones del tercero: justo lo que hace una ficha propia. Zona roja:
  **insinuar delito** ("amaño", "comisión", "enchufe").
- **Información vs. opinión:** "derroche" es un juicio de valor protegido salvo
  que sea vejatorio. Pero un **contador de "dinero derrochado"** presenta una
  valoración como cifra de hecho. Hace falta metodología pública, criterios de
  inclusión y etiqueta tipo *"gasto cuestionado según los criterios de Razón
  Común"*.
- **Rectificación (LO 2/1984):** el afectado la pide en 7 días; se publica en
  3, con relevancia semejante. Que la web de un partido sea "medio" es
  discutible: **se aplica igualmente por diseño**. Existe un **Proyecto de LO
  del derecho de rectificación** (expte. 121/000083) que lo extiende a
  plataformas y "usuarios de especial relevancia"; estado a vigilar ⚖️.

## 2. Propiedad intelectual (TRLPI, RDLeg 1/1996)

- **Resubir el reel** = reproducción y comunicación pública (arts. 18, 20):
  requiere licencia. **No se hace.**
- **Derecho de cita** (art. 32.1): solo fragmentos, para análisis o crítica,
  citando fuente y autor. No ampara el reel entero.
- **Embed:** no hay "público nuevo" si se usa el reproductor oficial sobre
  contenido lícito y abierto (TJUE *Svensson* C-466/12, *BestWater* C-348/13;
  *GS Media* C-160/15 presume conocimiento si hay ánimo de lucro). Sí lo hay
  si se eluden medidas técnicas (*VG Bild-Kunst* C-392/19). → **oEmbed oficial
  y nada más.**
- **Audio:** transcribir para análisis interno es lícito; para publicar, un
  **resumen propio con citas breves entrecomilladas**. Los hechos y datos no
  están protegidos.
- **Imagen y voz del creador** con fin propagandístico: posible art. 7.6 LO
  1/1982 ⚖️. No usar fotogramas del creador en la ficha; sí los de documentos
  o pantallas.
- **Minería de textos y datos** (arts. 67–68 TRLPI): respetar el *opt-out* del
  titular si lo ha expresado.

## 3. Condiciones de Meta / Instagram

- Las Condiciones de Uso y los *Automated Data Collection Terms* prohíben la
  recogida automatizada sin permiso previo, con o sin sesión. **Nada de
  scraping** (Apify, yt-dlp, RSS de terceros) en el producto.
- Vías legítimas: Graph API Business Discovery (metadatos y permalinks),
  oEmbed Read (incrustar), y **acuerdo con el creador** (autoriza con su
  cuenta o envía los vídeos).
- Cumplir los Meta Platform Terms: ni perfilado ni almacenar más de lo
  necesario (guardar caption, permalink, fecha; el vídeo solo el tiempo de
  procesarlo salvo acuerdo con el creador). ⚖️ Revisar términos vigentes.

## 4. Protección de datos (RGPD / LOPDGDD)

- **Base jurídica:** interés legítimo (art. 6.1.f) ponderado con la libertad
  de información (art. 20 CE). El art. 85 RGPD no tiene desarrollo específico
  en España; la AEPD pondera caso a caso.
- **Datos de infracciones** (art. 10 RGPD): no imputar ilícitos a personas
  físicas.
- **Fuentes oficiales:** Ley 37/2007 (reutilización sujeta a protección de
  datos), Ley 19/2013 (art. 8 publicidad de contratos; art. 15 límites), LCSP
  art. 63 (perfil del contratante). **Que un dato sea público no da carta
  blanca para reutilizarlo con otra finalidad.**
- **Minimización:** de autónomos adjudicatarios, solo nombre/NIF tal como
  consta en la adjudicación y solo si es imprescindible; nunca domicilio. De
  cargos públicos, solo lo relativo a la función. BORME **no** se automatiza.
- **Obligaciones:** información a los afectados (art. 14, excepción 14.5.b);
  derechos de oposición y supresión (arts. 17, 21; art. 93 LOPDGDD) con canal
  visible; revisión humana (art. 22); **EIPD** (art. 35: seguimiento
  sistemático con IA + publicación); registro de actividades (art. 30);
  **contrato de encargado** (art. 28) con los proveedores de IA y de
  transcripción.
- **Periodo electoral:** art. 58 bis LOREG (apdo. 1 anulado por STC 76/2019).

## 5. Reglamento (UE) 2024/1689 de IA

- **Art. 50.4, párr. 2:** quien publique texto generado/manipulado con IA para
  informar al público sobre asuntos de interés público debe revelarlo, **salvo**
  revisión humana o control editorial con responsable editorial identificado.
  La revisión humana **documentada** exime; se añade aviso voluntario igualmente.
- Aplicable desde el **2-8-2026**. El *Digital Omnibus* aplazó solo el art.
  50.2 (marcado por proveedores) al 2-12-2026 ⚖️ verificar en DOUE.
- Art. 4 (alfabetización en IA): exigible desde 02-2025 — formación breve a
  los auditores. Autoridad: AESIA.

## 6. Electoral y financiación de partidos

- **LOREG:** fuera de campaña no se pide el voto (art. 53); en **jornada de
  reflexión** nada de novedades ni promoción → *protocolo de pausa*; en
  campaña, el coste computa como gasto electoral (arts. 130–131).
- **Reglamento (UE) 2024/900** (publicidad política, aplicable desde 10-2025):
  si hay promoción pagada o creador remunerado, etiquetado y aviso de
  transparencia ⚖️.
- **LO 8/2007 (financiación):** un servicio gratuito del creador es **donación
  en especie** (art. 4.2), identificada y documentada, límite 50.000 €/año
  (art. 5); prohibidas aportaciones de personas jurídicas y de empresas con
  contratos públicos (arts. 5, 7). Si se le paga: contrato, contabilidad,
  Tribunal de Cuentas. El creador debe identificar contenido patrocinado (art.
  20 LSSI; Ley 13/2022 art. 94).

## 7. EMFA y DSA

- **EMFA (2024/1083):** un partido no es prestador de servicios de medios; no
  aplica en lo sustancial.
- **DSA (2022/2065) / LSSI:** solo si la web aloja contenido de usuarios
  (comentarios). La sección de auditoría **no tendrá comentarios** en esta
  fase; el formulario de rectificación no es contenido publicado.

## 8. Medidas de diseño obligatorias (checklist de aceptación)

Cada medida tiene dueño técnico en el documento 06 y criterio de aceptación en
el 05.

| # | Medida | Dónde se materializa |
|---|---|---|
| M1 | **Ninguna ficha se publica sin aprobación de un revisor humano**, con nombre y fecha registrados y visibles en la ficha. | `watchdog_alerts.verified_by/verified_at`, RLS que impide `published` sin `verified_by`, `audit_log`. |
| M2 | **Cada ficha enlaza a la fuente oficial** con identificador de expediente y **copia sellada** (hash + fecha) del documento. | `watchdog_evidence.url/snapshot_path/snapshot_sha256`. Bloqueo de publicación sin al menos una prueba `source_kind` oficial. |
| M3 | **Dos bloques separados y señalizados:** "Hechos verificados" / "Valoración de Razón Común". | Campos `hechos_html` y `valoracion_html`; diseño con cabeceras fijas. |
| M4 | **Contador = "gasto cuestionado verificado"**, con metodología pública. Las fichas en revisión, rectificadas o desmentidas **no suman**. | Función SQL `watchdog_totals()`; página `/auditoria/metodologia`. |
| M5 | **Lenguaje prudente:** no se imputan delitos ni se usan calificativos vejatorios; personas físicas solo si es imprescindible. | Guía de estilo en el prompt de resumen + lista de términos bloqueados en el guardrail + checklist en el formulario de aprobación. |
| M6 | **Derecho de réplica previo (48–72 h)** a la empresa/órgano afectado antes de publicar; su respuesta se incluye. | Campos `replica_solicitada_at`, `replica_texto`; estado `pendiente_replica`; el botón "publicar" avisa si no se ha solicitado. |
| M7 | **Formulario de rectificación y oposición** visible, respuesta en 3 días, aviso "rectificado" e **historial de versiones**. | Tabla `watchdog_corrections`; `watchdog_alert_versions`; bandera `rectificado_at` en ficha. |
| M8 | **Aviso de uso de IA** en cada ficha y página de transparencia con **responsable editorial** nombrado. | Pie de ficha; `/auditoria/metodologia#ia`. |
| M9 | **Reels incrustados con oEmbed oficial**, cita breve y resumen propio. Sin descarga de terceros, sin resubir, sin scraping. | Componente `ReelEmbed`; el bucket privado solo guarda el vídeo mientras se procesa (TTL 7 días) salvo acuerdo con el creador. |
| M10 | **Acuerdo escrito con el creador** (licencia, acceso, retribución o donación conforme a LO 8/2007). | Decisión D-A03; documento aparte fuera del repo. |
| M11 | **Conservación de pruebas** (análisis, versiones de fuentes, decisiones) ≥ 4 años (prescripción LO 1/1982). | Retención en Storage y en `audit_log` (append-only ya). |
| M12 | **EIPD, registro de actividades, contrato de encargado** con proveedores de IA/transcripción; **protocolo electoral** (pausa en jornada de reflexión, cómputo en campaña). | Documentos fuera del repo; bandera `AUDITORIA_PAUSA` en admin para la jornada de reflexión. |

## 9. A validar con abogado antes del lanzamiento

1. Fichas que mencionen personas físicas o sugieran ilícitos (muestra de 5).
2. Alcance de los arts. 32 TRLPI y 7.6 LO 1/1982 para el uso del reel.
3. Estructura de la colaboración con el creador.
4. Encaje en el Reglamento 2024/900 si hay cualquier pago.
5. Texto final del Omnibus (art. 50) y estado del proyecto de ley de
   rectificación.

## Referencias

LO 1/1982 · LO 2/1984 · TRLPI · LOPDGDD · LOREG · LO 8/2007 · Ley 37/2007 ·
Ley 19/2013 · Reglamento (UE) 2024/1689 (EUR-Lex `eli/reg/2024/1689`) ·
Reglamento (UE) 2024/900 · CURIA C-466/12, C-348/13, C-160/15, C-392/19 ·
Meta Platform Terms y Automated Data Collection Terms (developers.facebook.com).
