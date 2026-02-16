###############################################
# CLIENT BUILDER
###############################################
FROM node:22-alpine AS client-builder

WORKDIR /app

# Guacamole JS client lib
COPY vendor/guacamole-client/guacamole-common-js/ ./vendor/guacamole-client/guacamole-common-js/

WORKDIR /app/client

COPY client/package.json client/yarn.lock ./
RUN for i in 1 2 3; do yarn install --frozen-lockfile --network-timeout 500000 && break || sleep 15; done

COPY client/ .
RUN yarn build



###############################################
# SERVER BUILDER
###############################################
FROM node:22-alpine AS server-builder

ARG VERSION

WORKDIR /app

RUN apk add --no-cache \
    python3 py3-pip py3-setuptools \
    make g++ gcc build-base \
    jq

COPY package.json yarn.lock ./

RUN if [ -n "$VERSION" ]; then \
        jq --arg v "$VERSION" '.version = $v' package.json > tmp.json && mv tmp.json package.json; \
    fi

RUN for i in 1 2 3; do yarn install --production --frozen-lockfile --network-timeout 500000 && break || sleep 15; done

COPY server/ server/



###############################################
# GUACD BUILDER (Guacamole server)
###############################################
FROM node:22-alpine AS guacd-builder

RUN apk add --no-cache \
    cairo-dev jpeg-dev libpng-dev ossp-uuid-dev \
    pango-dev libvncserver-dev libwebp-dev openssl-dev freerdp2-dev \
    pulseaudio-dev libvorbis-dev libogg-dev libssh2-dev \
    ffmpeg-dev \
    build-base autoconf automake libtool

WORKDIR /build

COPY vendor/guacamole-server/ ./guacamole-server/

RUN cd guacamole-server \
    && autoreconf -fi \
    && ./configure \
        --with-init-dir=/etc/init.d \
        --prefix=/usr/local \
        --disable-guacenc \
        --disable-guaclog \
    && make -j"$(nproc)" \
    && make install \
    && rm -rf /usr/local/include \
    && rm -f /usr/local/lib/*.a \
    && rm -f /usr/local/lib/*.la \
    && rm -f /usr/local/*.md /usr/local/LICENSE \
    && strip /usr/local/sbin/guacd /usr/local/lib/*.so.* 2>/dev/null || true



###############################################
# FINAL RUNTIME IMAGE
###############################################
FROM node:22-alpine

RUN apk add --no-cache \
    cairo jpeg libpng ossp-uuid \
    pango libvncserver libwebp openssl freerdp2-libs \
    pulseaudio libvorbis libogg libssh2 \
    ffmpeg-libavcodec ffmpeg-libavformat ffmpeg-libavutil ffmpeg-libswscale \
    util-linux samba-client

# Copy everything Guacamole installed under /usr/local from the builder
COPY --from=guacd-builder /usr/local/ /usr/local/

RUN ldconfig /usr/local/lib 2>/dev/null || true

ENV NODE_ENV=production
ENV LOG_LEVEL=system

WORKDIR /app

COPY --from=client-builder /app/client/dist ./dist

COPY --from=server-builder /app/server ./server
COPY --from=server-builder /app/node_modules ./node_modules
COPY --from=server-builder /app/package.json ./
COPY --from=server-builder /app/yarn.lock ./

COPY docker-start.sh .
RUN chmod +x docker-start.sh

EXPOSE 6989

CMD ["/bin/sh", "docker-start.sh"]