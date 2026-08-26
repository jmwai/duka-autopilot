ARG NODE_IMAGE=node:24.12.0-bookworm-slim@sha256:7326fb2dbdce998edd72140946851be64ef4a643e8715e138ca467e8e9d92c99

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH
RUN corepack enable \
    && corepack prepare pnpm@11.9.0 --activate
WORKDIR /app

FROM base AS dependencies
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=dependencies /app/node_modules ./node_modules
COPY frontend/ ./
RUN pnpm build

FROM ${NODE_IMAGE} AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=8080

RUN groupadd --system --gid 10001 duka \
    && useradd --system --uid 10001 --gid duka --home-dir /app duka

WORKDIR /app
COPY --from=builder --chown=duka:duka /app/public ./public
COPY --from=builder --chown=duka:duka /app/.next/standalone ./
COPY --from=builder --chown=duka:duka /app/.next/static ./.next/static

USER 10001:10001
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
