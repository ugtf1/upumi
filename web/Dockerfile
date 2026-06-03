# Build stage
FROM node:20-slim AS build
WORKDIR /app
ARG VITE_API_BASE
ENV VITE_API_BASE=$VITE_API_BASE

# Copy package files and install dependencies
COPY package.json yarn.lock ./

RUN corepack enable
RUN corepack prepare yarn@1.22.22 --activate && yarn install --frozen-lockfile

COPY . .
RUN yarn build

# Runtime stage (serve static)
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
