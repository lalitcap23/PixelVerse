FROM node:18-alpine

# openssl needed by Prisma
RUN apk add --no-cache openssl

RUN npm install -g pnpm@8.15.6

WORKDIR /app

# Copy workspace config files first (for better layer caching)
COPY pnpm-workspace.yaml .npmrc package.json pnpm-lock.yaml ./

# Copy each package's package.json (needed for pnpm to resolve workspace deps)
COPY packages/db/package.json         ./packages/db/
COPY packages/db/prisma/              ./packages/db/prisma/
COPY packages/typescript-config/      ./packages/typescript-config/
COPY packages/eslint-config/          ./packages/eslint-config/
COPY packages/ui/package.json         ./packages/ui/
COPY apps/ws/package.json             ./apps/ws/

# Install all dependencies
RUN pnpm install --no-frozen-lockfile

# Copy all source code
COPY packages/ ./packages/
COPY apps/ws/ ./apps/ws/

# Generate Prisma Client
RUN cd packages/db && npx prisma generate

# Build the WS server (esbuild bundles it to dist/index.js)
WORKDIR /app/apps/ws
RUN npm run build

EXPOSE 3001

CMD ["node", "dist/index.js"]
