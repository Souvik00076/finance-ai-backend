FROM oven/bun:alpine AS base

WORKDIR /app

COPY package.json *.lock* ./ 

FROM base AS dev-deps

RUN bun install --frozen-lockfile

FROM base AS prod-deps

RUN bun install --production --frozen-lockfile

FROM dev-deps AS build

COPY . .

RUN bun build index.ts \
  --outdir dist \
  --target node \
  --minify \
  --sourcemap

FROM oven/bun:alpine AS prod_runtime

WORKDIR /app 

COPY --from=prod-deps /app/node_modules ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json .

EXPOSE 8000

CMD ["bun", "dist/index.js"]

