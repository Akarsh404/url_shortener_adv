# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --cache /tmp/npm-cache

# Generate Prisma client
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src/

RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

COPY package*.json ./

RUN npm ci --omit=dev --cache /tmp/npm-cache && \
    rm -rf /tmp/npm-cache

COPY prisma ./prisma/
RUN npx prisma generate

COPY --from=builder /app/dist ./dist

# Non-root user for security
RUN addgroup -g 1001 -S shortify && \
    adduser -S shortify -u 1001
USER shortify

EXPOSE 8080

# Use dumb-init to handle SIGTERM properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
