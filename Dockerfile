# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package.json ./

# Install production dependencies (will rebuild better-sqlite3 for Alpine)
RUN npm install --production

# Copy built frontend
COPY --from=builder /app/dist ./dist

# Copy backend server
COPY server ./server

# Create data directory for SQLite
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=80

EXPOSE 80

CMD ["node", "server/index.js"]