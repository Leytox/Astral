FROM mcr.microsoft.com/devcontainers/javascript-node:24-bookworm
COPY --from=oven/bun:1.4.0 /usr/local/bin/bun /usr/local/bin/bun
RUN ln -sf /usr/local/bin/bun /usr/local/bin/bunx \
    && apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg procps \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
