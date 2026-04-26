# Build stage
FROM node:22-slim AS builder
WORKDIR /app

# Install build dependencies and cloudflared
RUN apt-get update && apt-get install -y curl ca-certificates procps && rm -rf /var/lib/apt/lists/*

RUN curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb \
    && dpkg -i cloudflared.deb \
    && rm cloudflared.deb

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production image
FROM node:22-slim AS runner
WORKDIR /app

# Copy cloudflared and built app
COPY --from=builder /usr/bin/cloudflared /usr/bin/cloudflared

COPY --from=builder /app/next.config.mjs ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/start.sh ./

RUN chmod +x start.sh

EXPOSE 8080

# Use the startup script
CMD ["./start.sh"]
