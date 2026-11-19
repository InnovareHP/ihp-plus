#!/bin/sh
# Calls one cron route on the web app the way Vercel Cron did, logging to the container's stdout.
. /etc/cron.env
status=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 900 \
  -H "authorization: Bearer $CRON_SECRET" "$WEB_URL$1" 2>&1)
echo "$(date -u +%FT%TZ) $1 -> $status" > /proc/1/fd/1
case "$status" in 2??) ;; *) exit 1 ;; esac
