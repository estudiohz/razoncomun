# apps/web/Dockerfile
# Build multi-stage de la webapp Next.js (App Router) para Dokploy.
# Propiedad de rc-01-infra (D-003): este es el ÚNICO archivo que rc-01 escribe
# bajo apps/web/ — el resto del proyecto Next.js lo crea rc-04-front.
#
# Requisito de contrato con rc-04-front: next.config.{js,mjs,ts} debe declarar
#   output: 'standalone'
# para que exista .next/standalone tras `next build` (si no está puesto,
# este build falla en el stage "runner" al copiar esa carpeta — avisar a
# rc-04-front, no arreglarlo aquí).
#
# Basado en el patrón oficial de Next.js para Docker + output standalone
# (verificado contra examples/with-docker del repo vercel/next.js, 19/07/2026),
# adaptado a Node 20-alpine + npm según el brief de esta ola.

# ---------- Stage "base": imagen común ----------
FROM node:20-alpine AS base

# ---------- Stage 1: dependencias ----------
FROM base AS deps
# libc6-compat: necesario en Alpine para binarios nativos que algunas deps
# de Next.js/npm pueden traer (p.ej. sharp, si se añade más adelante).
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
# npm ci exige package-lock.json presente y en sync con package.json.
RUN npm ci --no-audit --no-fund

# ---------- Stage 2: build ----------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
# Descomentar para no enviar telemetría de Next.js durante el build:
# ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ---------- Stage 3: runtime ----------
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
# Descomentar para no enviar telemetría de Next.js en tiempo de ejecución:
# ENV NEXT_TELEMETRY_DISABLED=1

# Usuario no-root dedicado (buena práctica de seguridad en producción).
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Permisos correctos para la cache de prerender.
RUN mkdir .next && chown nextjs:nodejs .next

# output: 'standalone' reduce drásticamente el tamaño de imagen final:
# solo copia el árbol de dependencias que el server realmente usa.
# https://nextjs.org/docs/app/api-reference/config/next-config-js/output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# Healthcheck simple contra la propia app (Dokploy también puede definir el
# suyo vía dominio, esto ayuda a `docker compose ps` y a Dokploy's healthchecks
# si los usa). Ajustar la ruta si rc-04-front expone /api/health.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["node", "server.js"]
