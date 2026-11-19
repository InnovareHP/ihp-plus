# Moving apps/web from Vercel to Railway

Railway project **ihp-plus** (workspace InnovareHP), environment `production`. Both services build
from the repo root; their settings live on the service, not in a config file.

| Service | Settings                                                                           | What it runs                            |
| ------- | ---------------------------------------------------------------------------------- | --------------------------------------- |
| `web`   | Dockerfile `infra/docker/web.Dockerfile`, healthcheck `/app/api/health`, port 3000 | Next standalone + alpine Chromium       |
| `cron`  | Dockerfile `infra/docker/cron.Dockerfile`, restart always, watches `infra/cron/**` | busybox `crond` on `infra/cron/crontab` |

Railway's own cron jobs allow one schedule per service and expect the process to exit, so the 15
Vercel crons live in one always-on `crond` container instead. Each run logs
`<time> <path> -> <status>` to the `cron` service's logs.

## Setup

Done: project, both services, the settings above, `web-production-5144990c.up.railway.app` on
`web`, `PORT=3000` on `web`, `WEB_URL=https://${{web.RAILWAY_PUBLIC_DOMAIN}}` on `cron`.

1. `web` variables: everything the Vercel project has (Vercel → Settings → Environment Variables).
   `NEXT_PUBLIC_POSTHOG_*` are build args, so set them before the first build.
2. Push, then connect `InnovareHP/ihp-plus` (branch `main`) as each service's source — that starts
   the first build.
3. Run migrations from a machine with the production `DATABASE_URL`: `pnpm db:migrate` (unchanged
   from Vercel — the standalone image carries no Prisma CLI).
4. Until DNS moves, test on the Railway domain with `BETTER_AUTH_URL` set to it.

## Cutover

Vercel Cron and the scheduler must not both run — the jobs send email.

1. Leave `CRON_SECRET` off `cron` at first: every call answers 401, nothing runs, and the logs
   show the schedule firing.
2. Add the custom domain to `web` and move DNS, point `WEB_URL` at it, set
   `CRON_SECRET=${{web.CRON_SECRET}}` on `cron`, then delete `apps/web/vercel.json` (its rewrite
   now lives in `next.config.ts`) and the Vercel project.
3. Update `BETTER_AUTH_URL`, the Microsoft Entra redirect URIs, and `GRAPH_NOTIFICATION_URL` if the
   origin changed.

## Still on Vercel

`apps/landing` and `LANDING_DEPLOY_HOOK_URL` (the careers rebuild hook) are untouched. Railway has no
deploy-hook URL, so moving landing means replacing that hook with a Railway API call.
