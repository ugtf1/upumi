# ---------- Build stage ----------
FROM node:20-alpine AS build
WORKDIR /app

# Install deps (no package-lock.json present, so use npm install)
COPY package.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build

# ---------- Runtime stage ----------
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Copy only what we need
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/dist ./dist

EXPOSE 8080
CMD ["node", "dist/server.js"]
