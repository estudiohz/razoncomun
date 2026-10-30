# Auditoría en tiempo real — Documentación de la fase

> **Estado: investigación y planificación cerradas; desarrollo NO iniciado.**
> Fecha: 30-10-2026. Rama de trabajo: `claude/sleepy-goodall-gtu7j6` (→ `dev`).

Esta carpeta es la única documentación de producto que vive en el repo de
código (la documentación general del proyecto —ideario, marca, plan de
lanzamiento, equipo de agentes— vive en el repositorio de documentación aparte,
ver `README.md` raíz). Se guarda aquí a propósito: la fase toca varias capas
(base de datos, servicio cerebro, worker nuevo, admin, web pública) y los
agentes que la construyan necesitan el brief junto al código que van a tocar.

## Qué es

Un módulo que **detecta** los reels nuevos de cuentas vigiladas de Instagram
(la primera, `@elrastrodeldinero`, que denuncia gastos sospechosos del
Gobierno; más cuentas después) o los **recibe por Telegram**, los
**analiza** con IA (transcripción + lectura de los fotogramas), **contrasta**
los datos (organismo, adjudicatario, NIF, importe, expediente) contra las
fuentes oficiales (PLACSP, BOE, BDNS, BORME), los pasa por una **revisión
humana obligatoria** y, solo entonces, los **publica** en una sección pública
`/auditoria` de razoncomun.com con un contador acumulado de gasto cuestionado.

## Índice

| Doc | Contenido | Para quién |
|---|---|---|
| [01-vision-y-alcance.md](01-vision-y-alcance.md) | Objetivo, alcance, fuera de alcance, criterios de éxito, KPIs | Todos |
| [02-investigacion-tecnica.md](02-investigacion-tecnica.md) | Hallazgos verificados sobre API de Instagram, descarga, transcripción, PLACSP, BOE, BDNS, BORME; costes | Agentes técnicos |
| [03-marco-legal-y-cumplimiento.md](03-marco-legal-y-cumplimiento.md) | Riesgos legales (honor, propiedad intelectual, Meta, RGPD, AI Act, electoral) y 12 medidas de diseño obligatorias | Sergio, abogado, DPD, todos los agentes |
| [04-arquitectura.md](04-arquitectura.md) | Pipeline, componentes, modelo de datos (migración 0068 sobre la 0015), endpoints, contratos entre piezas, seguridad | Agentes técnicos |
| [05-plan-de-proyecto.md](05-plan-de-proyecto.md) | Fases, hitos, estimación, dependencias, riesgos, costes, criterios de aceptación | Sergio, orquestador |
| [06-equipo-de-agentes.md](06-equipo-de-agentes.md) | Reparto por agentes (rc-09 … rc-13 + los existentes), con brief listo para arrancar cada uno, propiedad de archivos y definición de hecho | Orquestador |
| [07-decisiones.md](07-decisiones.md) | Registro de decisiones (cerradas y pendientes) con su justificación | Todos |

## Principios innegociables de la fase

1. **Humano verifica y firma SIEMPRE antes de publicar.** Ya está escrito en el
   esquema (`watchdog_alerts`, migración 0015) y en `vision-plataforma.md`. La IA
   propone; una persona con rol decide, y queda registrado quién y cuándo.
2. **Cada ficha pública enlaza a la fuente oficial** con identificador de
   expediente y copia sellada del documento. Sin prueba oficial no hay ficha.
3. **Hechos y valoración van separados** en la ficha y en el lenguaje. El
   contador se llama "Gasto público señalado" (verificado contra fuentes
   oficiales), no "dinero derrochado".
4. **Nada de scraping ni de resubir vídeos.** Detección por API oficial de Meta,
   incrustación con oEmbed, resumen propio con citas breves.
5. **Cero secretos en el repo** (regla C5, repo público). Tokens de Meta, claves
   de transcripción y secretos de cron solo en Dokploy.
6. **Todo lo que escribe la IA es dato, nunca instrucción.** Las transcripciones y
   los captions pasan por el guardrail anti-inyección de RC-Brain antes de
   llegar a un prompt.
