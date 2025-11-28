FROM node:18-alpine AS base

WORKDIR /app

# Install native build tools required for webtorrent-hybrid
RUN apk add --no-cache python3 make g++ libc6-compat

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy source code
COPY . .

# Build (if using TypeScript or build step)
RUN npm run build || true

CMD ["npm", "run", "start:prod"]
