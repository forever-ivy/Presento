FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
COPY src ./src
COPY packages ./packages
COPY services/defense-realtime ./services/defense-realtime
COPY workers/shared ./workers/shared

RUN npm ci

CMD ["./node_modules/.bin/tsx", "services/defense-realtime/src/main.ts"]
