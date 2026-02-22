FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY dist/ ./dist/
COPY circuits_compiled/ ./circuits_compiled/
COPY keys/ ./keys/

EXPOSE 3000

CMD ["node", "dist/index.js"]
