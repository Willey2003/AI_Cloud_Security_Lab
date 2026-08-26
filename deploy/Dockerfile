# Sentinel//Lab console — hardened static build
# Build:  docker build -f deploy/Dockerfile -t sentinel-lab:0.1.0 .
# Run:    docker run -d -p 8443:8080 --read-only --tmpfs /var/cache/nginx --tmpfs /var/run sentinel-lab:0.1.0

# ---- Stage 1: build the static console ----
FROM node:20-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Stage 2: serve static assets from locked-down nginx ----
FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist /usr/share/nginx/html

# Non-root user; writable paths supplied as tmpfs/emptyDir at runtime
RUN addgroup -S lab && adduser -S lab -G lab \
 && chown -R lab:lab /usr/share/nginx/html /var/cache/nginx /var/run \
 && rm -rf /etc/nginx/conf.d/default.conf.bak /usr/share/nginx/html/*.md

USER lab
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null 2>&1 || exit 1
