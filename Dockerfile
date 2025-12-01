FROM node:18-bullseye-slim AS base

WORKDIR /app

RUN apt-get update && \
    apt-get install -y python3 build-essential openssl && \
    rm -rf /var/lib/apt/lists/*

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build (if using TypeScript or build step)
RUN npm run build || true

CMD ["npm", "run", "start:prod"]
