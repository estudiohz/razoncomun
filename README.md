# Razón Común — Webapp

Monorepo de la plataforma web de **Razón Común**, partido político español registrado en el Ministerio del Interior. Ver el proyecto completo (ideario, marca, contexto) en el repositorio de documentación: `docs/tecnico/`, `docs/ideario/`, `docs/marca/` (no vive en este repo de código — consultar con el equipo si necesitas acceso).

**Repo público por decisión deliberada** (transparencia radical del partido). Ver `docs/tecnico/revision-seguridad.md` (hallazgo C5) para la disciplina de secretos que esto exige.

## Stack

Next.js (App Router) + Supabase self-hosted (Postgres + pgvector) + n8n, todo autoalojado en un VPS con Dokploy. Decisión completa en `docs/tecnico/stack-y-despliegue.md`.

## Estructura del monorepo

```
razoncomun/
├── apps/web/          # Webapp Next.js (App Router). Dockerfile de despliegue incluido.
├── supabase/          # Migraciones SQL, RLS, seeds — propiedad de rc-02-datos.
├── infra/             # Docker Compose de Supabase self-hosted + Ollama, backups cifrados,
│                       # guía de despliegue/auditoría en Dokploy. Propiedad de rc-01-infra.
├── n8n/                # Exports de workflows de automatización (sin credenciales).
└── bot/                # Bot de Discord del RC-Brain.
```

## Cero secretos en este repo

Ningún `.env`, clave, token o contraseña debe llegar nunca a un commit — es un repo público. Cada carpeta con necesidad de secretos trae su propio `*.env.example` documentado; los valores reales viven en `infra/.env` local (ignorado por git) o en la configuración de cada servicio en Dokploy.

## Despliegue

Ver `infra/GUIA-DOKPLOY.md` para el procedimiento completo de despliegue, verificación y auditoría de todo lo que corre en el VPS.

## Construcción

Este proyecto se construye con un equipo de agentes de Claude Code por olas. Ver `docs/tecnico/plan-lanzamiento.md` y `docs/tecnico/equipo-agentes.md` en el repositorio de documentación del proyecto.
