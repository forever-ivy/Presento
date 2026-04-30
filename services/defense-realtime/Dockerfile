FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
COPY src ./src
COPY packages ./packages
COPY services/defense-realtime ./services/defense-realtime

RUN npm ci

CMD ["node", "services/defense-realtime/src/main.ts"]
