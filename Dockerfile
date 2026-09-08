# sherpa-onnx 사전 빌드 바이너리가 glibc에 링크되어 있어 Alpine(musl)에서는
# ld-linux-aarch64.so.1 을 찾지 못한다. glibc 계열인 slim 을 쓴다.
FROM node:22-slim AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

RUN mkdir -p uploads && chown nextjs:nodejs uploads

# sherpa-onnx의 .so는 표준 검색 경로에 없으므로 명시해준다.
ENV LD_LIBRARY_PATH=/app/node_modules/sherpa-onnx-linux-arm64:/app/node_modules/sherpa-onnx-linux-x64

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
