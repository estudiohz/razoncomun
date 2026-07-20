# lib/brain/ingest/Dockerfile
#
# Job de ingesta del RC-Brain. Contenedor mínimo (sin build de npm: el código
# es JS puro con módulos ES nativos de Node 20, cero dependencias externas --
# ver README "Por qué cero dependencias").
#
# No es un servicio persistente: se ejecuta, ingiere el corpus disponible y
# termina (restart: "no" en docker-compose.brain-ingest.yml, mismo patrón que
# infra/docker-compose.ollama.yml usa para "ollama-init").

FROM node:20-alpine

WORKDIR /app

COPY src ./src
COPY package.json ./

# Sin `npm ci`/`npm install`: no hay dependencias en package.json (ver README).
# Si en el futuro se añade alguna, restaurar el paso de instalación aquí.

ENTRYPOINT ["node", "src/index.mjs"]
CMD ["--sources=manifiesto,docs"]
