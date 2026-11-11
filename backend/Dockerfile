FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN mkdir -p /app/uploads/logos /app/uploads/portadas && chown -R node:node /app

EXPOSE 3000

USER node
CMD ["node", "src/server.js"]
