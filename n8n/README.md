# n8n/

Esqueleto para los workflows de automatización de Razón Común (observatorio de noticias, clasificador de opiniones, sync de finanzas, ingesta del RC-Brain — ver `docs/tecnico/rc-brain.md` y `docs/tecnico/chatbot-opina.md`). Propiedad principal: **rc-08-brain**.

## Estado (Ola 0)

Vacío deliberadamente. La infraestructura de n8n en sí **ya existe** en el VPS (`n8n.estudiohorizontal.es`, compartida con la agencia — ver `docs/tecnico/revision-seguridad.md`, hallazgo I2, decisión pendiente ⏳ sobre si el partido monta instancia propia).

## Qué va aquí más adelante

- Exports JSON de los workflows propios del partido (una vez decidido I2).
- **Regla no negociable (C5, repo público):** ningún export debe contener credenciales embebidas ni URLs de webhook con token — revisar cada export antes de commitear. Los nodos de credenciales de n8n deben quedar vacíos/placeholder en el JSON versionado.

## Qué NO vive aquí

- Las credenciales de conexión a n8n o de sus integraciones: en el propio panel de n8n o en gestor de secretos, nunca en el repo.
