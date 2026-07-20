# lib/brain/service/Dockerfile
#
# rc-brain-service: servicio PERSISTENTE (a diferencia de rc-brain-ingest, que
# corre y termina). JS puro con módulos ES nativos de Node 20, cero
# dependencias externas -- mismo patrón que lib/brain/ingest/Dockerfile.

FROM node:20-alpine

WORKDIR /app

COPY src ./src
COPY package.json ./

# Sin `npm ci`/`npm install`: no hay dependencias en package.json.

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:8787/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

ENTRYPOINT ["node", "src/server.mjs"]
