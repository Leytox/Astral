# Astral API

NestJS backend for Astral: authentication, users, albums, songs, genres, uploads, emails, queues, and realtime upload events.

## Stack

- NestJS
- Prisma + PostgreSQL
- Redis + BullMQ
- S3-compatible storage / MinIO
- Socket.IO
- Swagger/OpenAPI
- Bun

## Requirements

- Bun
- Docker / Docker Compose
- PostgreSQL
- Redis
- S3-compatible storage, e.g. MinIO
- SMTP server, e.g. Mailpit for local development

## Setup

From the repository root:

```sh
bun install
```

Create your API environment file from the example and fill required values:

```sh
cp apps/api/.env.example apps/api/.env
```

Start local infrastructure:

```sh
docker compose up -d postgres redis minio mailpit
```

Generate Prisma client and apply migrations:

```sh
bunx --cwd apps/api prisma generate
bunx --cwd apps/api prisma migrate dev
```

Start the API:

```sh
bun run --cwd apps/api dev
```

Default local API URL:

```txt
http://localhost:5000
```

Swagger docs are available outside production at:

```txt
http://localhost:5000/docs
```

Mailpit UI:

```txt
http://localhost:8025
```

## Scripts

Run from the repository root:

```sh
bun run --cwd apps/api dev          # start in watch mode
bun run --cwd apps/api build        # build API
bun run --cwd apps/api start:prod   # run built API
bun run --cwd apps/api lint         # lint and auto-fix
bun run --cwd apps/api test         # run tests
bun run --cwd apps/api test:e2e     # run e2e tests
```

## Main modules

- `auth` — registration, login, refresh tokens, password reset, sessions
- `users` — profile retrieval, update, soft delete
- `albums` — album search, create, edit, delete
- `songs` — upload, stream, edit, like, unlike, delete
- `genres` — genre search and management
- `upload` — queued S3/MinIO uploads
- `email` — queued transactional emails
- `events` — Socket.IO notifications

## Notes

- Refresh tokens are stored in an HttpOnly cookie named `refresh_token`.
- Access tokens are sent with the `Authorization: Bearer <token>` header.
- Background jobs require Redis.
- File storage requires an S3-compatible service and the expected buckets.
- Local Docker credentials are for development only.
