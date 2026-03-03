# Use a multi-stage build to combine the specific images
FROM ghcr.io/retropex/mempoolfrontend:v3.3.0-beta@sha256:5f515352f46b892bab7c70af76f716786946dfddb675a1cf7c60e78b0ae5b3fb AS frontend
FROM ghcr.io/retropex/mempoolbackend:v3.3.0-beta@sha256:05240bd6dda0b66c18273d1bd2643d58d0c4296437e6b4e3fdbfa1d46f03eb08 AS backend

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
  apt-get install -y --allow-downgrades nginx wait-for-it wget netcat-traditional \
  build-essential python3 pkg-config rsync gettext iproute2 pwgen \
  && wget https://github.com/mikefarah/yq/releases/download/v4.6.3/yq_linux_${PLATFORM}.tar.gz -O - |\
  tar xz && mv yq_linux_${PLATFORM} /usr/bin/yq \
  && apt-get clean

# Create mysql user and group
RUN groupadd -r mysql && useradd -r -g mysql mysql

# Install required base libraries
RUN apt-get update && \
  apt-get install -y curl gnupg lsb-release ca-certificates libncurses5 libjemalloc2 socat

# Install libssl1.1 from Buster (needed by MariaDB 10.4)
RUN echo "deb http://archive.debian.org/debian buster main" > /etc/apt/sources.list.d/buster.list && \
  echo 'Acquire::Check-Valid-Until "false";' > /etc/apt/apt.conf.d/99no-check-valid-until && \
  apt-get update && \
  apt-get install -y libssl1.1

# Install MariaDB 10.4 via .deb packages
RUN set -eux; \
  export MARIADB_VERSION=10.4.32; \
  export DISTRO=deb10; \
  export BASE_URL=https://archive.mariadb.org/mariadb-${MARIADB_VERSION}/repo/debian/pool/main/m/mariadb-10.4; \
  mkdir -p /tmp/mariadb && cd /tmp/mariadb && \
  curl -LO ${BASE_URL}/mariadb-common_${MARIADB_VERSION}+maria~${DISTRO}_all.deb && \
  curl -LO ${BASE_URL}/libmariadb3_${MARIADB_VERSION}+maria~${DISTRO}_${PLATFORM}.deb && \
  curl -LO ${BASE_URL}/mariadb-client-core-10.4_${MARIADB_VERSION}+maria~${DISTRO}_${PLATFORM}.deb && \
  curl -LO ${BASE_URL}/mariadb-client-10.4_${MARIADB_VERSION}+maria~${DISTRO}_${PLATFORM}.deb && \
  curl -LO ${BASE_URL}/mariadb-server-core-10.4_${MARIADB_VERSION}+maria~${DISTRO}_${PLATFORM}.deb && \
  curl -LO ${BASE_URL}/mariadb-server-10.4_${MARIADB_VERSION}+maria~${DISTRO}_${PLATFORM}.deb && \
  dpkg -i *.deb || apt-get install -f -y && \
  apt-mark hold mariadb-server mariadb-client && \
  rm -rf /var/lib/apt/lists/* /tmp/mariadb

# Copy frontend files
COPY --from=frontend /patch/entrypoint.sh /patch/entrypoint.sh
COPY --from=frontend /patch/wait-for /patch/wait-for
COPY --from=frontend /var/www/mempool /var/www/mempool
COPY --from=frontend /etc/nginx/nginx.conf /etc/nginx/
COPY --from=frontend /etc/nginx/conf.d/nginx-mempool.conf /etc/nginx/conf.d/

# BUILD S9 CUSTOM
ADD ./docker_entrypoint.sh /usr/local/bin/docker_entrypoint.sh
ADD assets/utils/*.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/*.sh
RUN mkdir -p /usr/local/bin/migrations
ADD ./scripts/migrations/*.sh /usr/local/bin/migrations
RUN chmod a+x /usr/local/bin/migrations/*

# remove to we can manually handle db initalization
RUN rm -rf /var/lib/mysql/
