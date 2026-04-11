FROM node:20-alpine AS frontend-deps
WORKDIR /app/frontend
RUN apk add --no-cache libc6-compat
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci \
    --fetch-retries=5 \
    --fetch-retry-mintimeout=10000 \
    --fetch-retry-maxtimeout=60000

FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY --from=frontend-deps /app/frontend/node_modules ./node_modules
COPY frontend/ ./
COPY shared/ /app/shared/
ARG NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS middleware-deps
WORKDIR /app/middleware
COPY middleware/package.json middleware/package-lock.json* ./
RUN npm ci \
    --omit=dev \
    --fetch-retries=5 \
    --fetch-retry-mintimeout=10000 \
    --fetch-retry-maxtimeout=60000

FROM node:20-alpine AS runtime
RUN apk add --no-cache postgresql-client dumb-init

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=middleware-deps /app/middleware/node_modules ./middleware/node_modules
COPY middleware/src ./middleware/src
COPY middleware/package.json ./middleware/package.json
COPY shared/ /app/shared/

COPY --from=frontend-builder /app/frontend/.next/standalone ./frontend
COPY --from=frontend-builder /app/frontend/.next/static ./frontend/.next/static
COPY --from=frontend-builder /app/frontend/public ./frontend/public

COPY backend/db/postgres /pgdb
COPY init/init-db-postgres.sh /app/init/init-db-postgres.sh
COPY start.sh /app/start.sh

# SECURITY: create non-root application user, set permissions, drop to non-root
RUN addgroup -g 1001 -S scapp \
    && adduser -S -D -H -h /app -u 1001 -G scapp scapp \
    && mkdir -p /app/uploads /app/init \
    && chmod +x /app/start.sh /app/init/init-db-postgres.sh \
    && chown -R scapp:scapp /app /pgdb

USER scapp

EXPOSE 3000 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/health/ready || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["/app/start.sh"]
