# Use a multi-stage build to combine the specific images
FROM ghcr.io/retropex/mempoolfrontend:v3.3.0-dev AS frontend
FROM ghcr.io/retropex/mempoolbackend:v3.3.0-dev AS backend
FROM mariadb:10.5.8 AS db
FROM node:lts-bookworm-slim AS runner

ENV MEMPOOL_CLEAR_PROTECTION_MINUTES="20"
ENV MEMPOOL_INDEXING_BLOCKS_AMOUNT="52560"
ENV MEMPOOL_STDOUT_LOG_MIN_PRIORITY="info"
ENV LIGHTNING_STATS_REFRESH_INTERVAL=3600
ENV LIGHTNING_GRAPH_REFRESH_INTERVAL=3600
ENV MEMPOOL_AUTOMATIC_POOLS_UPDATE=true
ENV MEMPOOL_AUDIT=true
ENV MEMPOOL_GOGGLES_INDEXING=true
ENV MEMPOOL_BLOCKS_SUMMARIES_INDEXING=true

USER root
# arm64 or amd64
ARG PLATFORM
# aarch64 or x86_64
ARG ARCH
# Install necessary packages
RUN apt-get update && \
    apt-get install -y nginx wait-for-it wget curl netcat-traditional \
    build-essential python3 pkg-config rsync gettext \
    mariadb-server mariadb-client libaio1 iproute2 pwgen \
    && wget https://github.com/mikefarah/yq/releases/download/v4.6.3/yq_linux_${PLATFORM}.tar.gz -O - |\
      tar xz && mv yq_linux_${PLATFORM} /usr/bin/yq \
    && apt-get clean
# RUN groupadd -r mysql && useradd -r -g mysql mysql

WORKDIR /patch

# Copy frontend files
COPY --from=frontend /patch/entrypoint.sh .
COPY --from=frontend /patch/wait-for .
COPY --from=frontend /var/www/mempool /var/www/mempool
COPY --from=frontend /etc/nginx/nginx.conf /etc/nginx/
COPY --from=frontend /etc/nginx/conf.d/nginx-mempool.conf /etc/nginx/conf.d/

WORKDIR /backend

# Copy backend files
COPY --from=backend /backend/package ./package/
COPY --from=backend /backend/GeoIP ./GeoIP/
COPY --from=backend /backend/mempool-config.json /backend/start.sh /backend/wait-for-it.sh ./

# Create data folder for cache and MySQL data
RUN mkdir -p /build/data/cache /var/lib/mysql/data

# Set user and group for the folders
RUN chown -R mysql:mysql /build/data /var/lib/mysql/data

# BUILD S9 CUSTOM
ADD ./docker_entrypoint.sh /usr/local/bin/docker_entrypoint.sh
ADD assets/utils/*.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/*.sh
RUN mkdir -p /usr/local/bin/migrations
ADD ./scripts/migrations/*.sh /usr/local/bin/migrations
RUN chmod a+x /usr/local/bin/migrations/*

# remove to we can manually handle db initalization
RUN rm -rf /var/lib/mysql/
