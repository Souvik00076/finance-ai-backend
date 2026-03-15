FROM oven/bun:alpine AS base
WORKDIR /app
COPY package.json *.lock* ./
RUN bun install --frozen-lockfile
COPY . .

RUN addgroup -g 1001 -S nodejs && \
  adduser -S nodejs -u 1001 && \
  chown -R nodejs:nodejs /app
USER nodejs
EXPOSE 8000
CMD ["bun", "index.ts"]


# FROM oven/bun:alpine AS base
#
# WORKDIR /app
#
# COPY package.json *.lock* ./ 
#
# FROM base AS dev-deps
#
# RUN bun install --frozen-lockfile
#
# FROM base AS prod-deps
#
# RUN bun install --production --frozen-lockfile
#
# FROM dev-deps AS build
#
# COPY . .
# ENV BUN_JSC_forceBaseline=1
# RUN bun build index.ts \
#   --outdir dist \
#   --target node \
#   --sourcemap \
#   --external mongoose
#
# FROM oven/bun:alpine AS prod_runtime
#
# WORKDIR /app 
#
# COPY --from=prod-deps /app/node_modules ./
# COPY --from=build /app/dist ./dist
# COPY --from=build /app/package.json .
#
# # Create non-root user and switch to it
# RUN addgroup -g 1001 -S nodejs && \
#     adduser -S nodejs -u 1001 && \
#     chown -R nodejs:nodejs /app
#
# USER nodejs
#
# EXPOSE 8000
#
# CMD ["bun", "dist/index.js"]
#
  
  
