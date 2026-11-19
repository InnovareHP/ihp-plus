# syntax=docker/dockerfile:1.7
# Scheduler: fires apps/web's cron routes on infra/cron/crontab. Needs WEB_URL and CRON_SECRET.
#   docker build -f infra/docker/cron.Dockerfile .

FROM alpine:3.22
RUN apk add --no-cache curl
COPY infra/cron/crontab /etc/crontabs/root
COPY --chmod=755 infra/cron/hit.sh /usr/local/bin/hit
# crond hands jobs a bare environment, so the service's variables are saved for hit.sh to load.
CMD ["sh", "-c", "export -p > /etc/cron.env && exec crond -f -l 8"]
