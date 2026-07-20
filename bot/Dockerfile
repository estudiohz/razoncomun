# bot/Dockerfile
# Bot de Discord del RC-Brain. A diferencia de lib/brain/*, SÍ tiene una
# dependencia (discord.js) -- inevitable para hablar el protocolo de Discord.
FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src

ENTRYPOINT ["node", "src/index.mjs"]
