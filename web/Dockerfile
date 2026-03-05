# Build stage
FROM node:20-slim AS build
WORKDIR /app
ARG VITE_API_BASE
ENV VITE_API_BASE=$VITE_API_BASE

COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
RUN if [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable && pnpm i --frozen-lockfile; \
  else npm install; fi

COPY . .
RUN if [ -f yarn.lock ]; then yarn build; \
  elif [ -f pnpm-lock.yaml ]; then pnpm build; \
  else npm run build; fi

# Runtime stage (serve static)
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
