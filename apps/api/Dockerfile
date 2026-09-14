# 1. Base stage with system dependencies (ffmpeg)
FROM oven/bun:canary AS base
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# 2. Development stage (with devDependencies, hot reload support)
FROM base AS development
WORKDIR /app

COPY package.json bun.lock turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json

RUN bun install --frozen-lockfile --backend=copyfile --ignore-scripts

COPY . .

WORKDIR /app/apps/api
RUN DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" bunx prisma generate

WORKDIR /app
RUN bun run --cwd packages/types build

WORKDIR /app/apps/api
EXPOSE 5000

CMD ["bun", "run", "dev"]

# 3. Builder stage to compile TypeScript for production
FROM development AS builder
WORKDIR /app
RUN bun run --cwd apps/api build

# 4. Production stage (minimal runner without devDependencies)
FROM base AS production
WORKDIR /app

ENV NODE_ENV=production

COPY package.json bun.lock turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json

RUN bun install --production --frozen-lockfile --backend=copyfile --ignore-scripts

COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/public ./apps/api/public
COPY --from=builder /app/apps/api/src/generated ./apps/api/src/generated
COPY --from=builder /app/packages/types ./packages/types

RUN chown -R bun:bun /app

WORKDIR /app/apps/api
EXPOSE 5000

USER bun

CMD ["bun", "dist/main.js"]
