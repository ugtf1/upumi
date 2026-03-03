# ---------- Build stage ----------
FROM node:20-bookworm-slim AS build
WORKDIR /app

# Install deps first (cache-friendly)
COPY package.json ./
# If you have a lockfile, copy it too for reproducibility
# COPY package-lock.json ./
RUN npm install

# Copy source
COPY . .

# Generate Prisma client (so enums like Role exist)
RUN npx prisma generate

# Build TS -> dist
RUN npm run build

# ---------- Runtime stage ----------
FROM node:20-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Copy runtime files
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public

EXPOSE 8080
CMD ["node", "dist/server.js"]
