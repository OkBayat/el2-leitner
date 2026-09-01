FROM node:22-alpine AS backend-dependencies

WORKDIR /app/back
COPY back/package*.json ./
RUN if [ -f package-lock.json ]; then \
      npm ci --omit=dev; \
    else \
      npm install --omit=dev --no-audit --no-fund; \
    fi

FROM node:22-alpine AS ui-build

WORKDIR /app/ui
COPY ui/package*.json ./
RUN npm ci
COPY ui ./
RUN npm run build && rm -rf node_modules

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY --chown=node:node back ./back
COPY --from=ui-build --chown=node:node /app/ui ./ui
COPY --from=backend-dependencies /app/back/node_modules ./back/node_modules

WORKDIR /app/back
USER node

EXPOSE 3000

CMD ["npm", "start"]
