# ─── Build stage ──────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.server.json ./
COPY src/ src/
COPY migrations/ migrations/

RUN npm run build
RUN npm run build:api

# ─── Production stage ─────────────────────────────────
FROM node:22-alpine AS production

WORKDIR /app

# Create non-root user and group (alpine uses addgroup/adduser)
RUN addgroup -g 1001 -S appgroup && \
    adduser -S -u 1001 -G appgroup appuser

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/build ./build
COPY --from=build /app/migrations ./migrations

RUN npm ci --omit=dev && \
    chown -R appuser:appgroup /app

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:8080/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

USER appuser

CMD ["node", "build/server/index.js"]
