FROM node:22-alpine AS backend-dependencies
WORKDIR /app/back
COPY back/package*.json ./
RUN npm ci --omit=dev

FROM node:22-alpine AS ui-build
WORKDIR /app/ui
COPY ui/package*.json ./
RUN npm ci
COPY ui/angular.json ui/tsconfig*.json ./
COPY ui/src ./src
COPY ui/assets ./assets
COPY ui/fonts ./fonts
COPY ui/data ./data
COPY ui/tools ./tools
RUN npm run build:production

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache bzip2
COPY --chown=node:node back ./back
COPY --from=ui-build --chown=node:node /app/ui/dist/browser ./ui
COPY --from=backend-dependencies /app/back/node_modules ./back/node_modules
WORKDIR /app/back
USER node
EXPOSE 3000
CMD ["npm", "start"]
