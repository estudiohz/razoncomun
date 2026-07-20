# bot/

Bot de Discord del RC-Brain (ver `docs/tecnico/rc-brain.md`). Propiedad: **rc-08-brain** (Ola 3).

## Estado (Ola 3)

Código completo, **NO verificado en ejecución** (sacrificable por presupuesto de la ola, priorizado tras chat web + gate + Opina — ver informe final de rc-08-brain). Sin `DISCORD_BOT_TOKEN` no se puede probar contra el Discord real.

- `@RC-Brain <pregunta>` (mención en el canal del equipo) -> `rc-brain-service` `/chat-team` (corpus completo, público + interno).
- `/opina texto:"..."` -> `/classify-opinion` (clasificación **de un único turno**, no la entrevista multi-turno de 1-2 repreguntas del widget web -- ver nota en `src/index.mjs`: replicar el estado de conversación en un hilo de Discord quedó fuera de esta ola).

El bot NUNCA toca Postgres/Ollama/Anthropic directamente: todo pasa por `rc-brain-service` vía `BRAIN_INTERNAL_TOKEN` (`src/brainClient.mjs`).

## Qué requiere de Sergio

1. Crear la aplicación en discord.com/developers/applications, activar "Message Content Intent", invitar el bot al servidor.
2. `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID` (ver `.env.example`).
3. `BRAIN_INTERNAL_TOKEN` (el mismo secreto configurado en `rc-brain-service`).
4. Correr `node src/registerCommands.mjs` una vez para registrar `/opina`.

## Qué NO vive aquí

- El token del bot ni ninguna credencial: en la config de Dokploy del servicio correspondiente, nunca en el repo (público).
