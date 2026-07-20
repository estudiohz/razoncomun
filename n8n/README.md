# n8n/

Workflows de automatización de Razón Común (observatorio de noticias, autopublicación en redes — ver `docs/tecnico/rc-brain.md` y Pilar 1.11 de `docs/vision-plataforma.md`). Propiedad principal: **rc-08-brain**.

## Estado (Ola 3)

`observatorio-diario.json` y `redes-autopublicacion.json`: **borradores de forma, NO importados ni activados** en ninguna instancia de n8n -- sacrificados deliberadamente por presupuesto (prioridad de la ola: chat web > gate > Opina > esto, ver informe final de rc-08-brain). Cada nodo lleva una nota explicando qué falta para poder activarlo de verdad: fuentes RSS reales, el endpoint exacto de publicación de rc-05-blog, el mecanismo de aprobación por reacción de Discord, y el token de Metricool (Sergio). Import de prueba con `node -e "JSON.parse(...)"` hecho (JSON válido), **nunca ejecutados contra n8n real**.

No se ha tocado la instancia compartida de la agencia (`n8n.estudiohorizontal.es`) -- la decisión I2 (instancia propia vs. compartida) sigue pendiente y no correspondía tomarla en esta ola.

## Qué va aquí más adelante

- Exports JSON de los workflows propios del partido (una vez decidido I2).
- **Regla no negociable (C5, repo público):** ningún export debe contener credenciales embebidas ni URLs de webhook con token — revisar cada export antes de commitear. Los nodos de credenciales de n8n deben quedar vacíos/placeholder en el JSON versionado.

## Qué NO vive aquí

- Las credenciales de conexión a n8n o de sus integraciones: en el propio panel de n8n o en gestor de secretos, nunca en el repo.
