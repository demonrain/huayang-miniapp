FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json ./
COPY server ./server

RUN mkdir -p /app/server/data /app/server/media

EXPOSE 8787
VOLUME ["/app/server/data", "/app/server/media"]

CMD ["node", "server/src/index.mjs"]

