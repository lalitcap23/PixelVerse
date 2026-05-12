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
COPY apps/http/package.json           ./apps/http/

# Install all dependencies
RUN pnpm install --no-frozen-lockfile

# Copy all source code
COPY packages/ ./packages/
COPY apps/http/ ./apps/http/

# Generate Prisma Client
RUN cd packages/db && npx prisma generate

# Build the HTTP server (esbuild bundles it to dist/index.js)
WORKDIR /app/apps/http
RUN npm run build

EXPOSE 3000

# Run migrations then start the server
CMD sh -c "cd /app/packages/db && npx prisma migrate deploy && cd /app/apps/http && node dist/index.js"
