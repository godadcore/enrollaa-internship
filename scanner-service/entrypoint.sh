#!/bin/sh
set -eu
freshclam --config-file=/app/freshclam.conf --stdout --foreground || { cat /tmp/freshclam.log >&2 2>/dev/null || true; echo "virus definitions unavailable" >&2; exit 1; }
cat /tmp/freshclam.log >&2 2>/dev/null || true
clamd --config-file=/app/clamd.conf --foreground &
daemon_pid=$!
trap 'kill "$daemon_pid" 2>/dev/null || true' TERM INT EXIT
exec node server.mjs
