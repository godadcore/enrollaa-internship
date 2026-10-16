FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends clamav clamav-daemon ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
COPY server.mjs entrypoint.sh clamd.conf freshclam.conf ./
RUN chmod 0555 entrypoint.sh server.mjs && mkdir -p /var/lib/clamav /run/clamav && chown -R node:node /app /var/lib/clamav /run/clamav
USER node
EXPOSE 8080
ENTRYPOINT ["./entrypoint.sh"]
