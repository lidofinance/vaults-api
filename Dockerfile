ARG ALPINE_VERSION=3.24

# Manifests only: this layer (and the install below) is reused for as long as
# package.json/yarn.lock are unchanged, so editing source does not re-install.
FROM node:24-alpine${ALPINE_VERSION} AS deps

WORKDIR /app

COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile --non-interactive \
    && yarn cache clean

# Production-only tree for the final image. Independent of `deps` (it needs the
# manifests too, nothing else) so BuildKit builds the two installs in parallel
# instead of waiting for the full tree to finish before pruning it.
FROM node:24-alpine${ALPINE_VERSION} AS prod-deps

WORKDIR /app

COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile --non-interactive --production \
    && yarn cache clean

FROM node:24-alpine${ALPINE_VERSION} AS building

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json yarn.lock ./
COPY ./tsconfig*.json ./
COPY ./src ./src

RUN yarn build

FROM alpine:${ALPINE_VERSION}

WORKDIR /app

RUN apk add --no-cache libstdc++=15.2.0-r5 \
  && addgroup -g 1000 node \
  && adduser -u 1000 -G node -s /bin/sh -D node

COPY --from=building /usr/local/bin/node /usr/local/bin/node
COPY --from=building /app/dist ./dist
# Production dependencies only — devDependencies never reach the final image.
COPY --from=prod-deps /app/node_modules ./node_modules

COPY ./network-configs ./network-configs
COPY ./package.json ./
COPY ./build-info.json ./

USER node

ENV NODE_OPTIONS="--max-old-space-size=4096"

HEALTHCHECK --interval=60s --timeout=10s --retries=3 \
  CMD sh -c "wget -nv -t1 --spider http://localhost:$PORT/health" || exit 1

CMD ["sh", "-c", "node ./node_modules/typeorm/cli.js migration:run -d ./dist/db/config.js && exec node dist/main"]
