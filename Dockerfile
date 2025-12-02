FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++ libc6-compat

COPY package*.json ./
RUN npm ci --production

COPY . .

RUN if [ -f tsconfig.json ]; then npm run build; fi

EXPOSE 3000 6881

ENV PORT=3000
ENV TORRENT_PORT=6881

CMD ["npm", "run", "start"]
