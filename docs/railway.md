# Moving apps/web from Vercel to Railway

Two Railway services, both built from the repo root with config-as-code in `infra/railway/`.

| Service | Config file               | What it runs                                                             |
| ------- | ------------------------- | ------------------------------------------------------------------------ |
| `web`   | `infra/railway/web.json`  | `infra/docker/web.Dockerfile` — Next standalone + alpine Chromium        |
| `cron`  | `infra/railway/cron.json` | `infra/docker/cron.Dockerfile` — busybox `crond` on `infra/cron/crontab` |

Railway's own cron jobs allow one schedule per service and expect the process to exit, so the 15
Vercel crons live in one always-on `crond` container instead. Each run logs
`<time> <path> -> <status>` to the `cron` service's logs.

## Setup

1. New Railway project, **Deploy from GitHub repo** twice (`web`, `cron`). In each service's
   Settings, set **Config file path** to `infra/railway/web.json` / `infra/railway/cron.json`;
   leave the root directory at the repo root.
2. `web` variables: everything the Vercel project has (copy from Vercel → Settings → Environment
   Variables), plus `PORT=3000` so Railway's injected port matches the image. Turbo is not in the
   path here, so `NEXT_PUBLIC_*` must be set before the first build.
3. `cron` variables: `CRON_SECRET=${{web.CRON_SECRET}}` and `WEB_URL` = the web app's public
   origin (no `/app`).
4. `web` → Networking → custom domain. Until DNS moves, test on the `*.up.railway.app` domain with
   `BETTER_AUTH_URL` set to it.
5. Run migrations from a machine with the production `DATABASE_URL`: `pnpm db:migrate` (unchanged
   from Vercel — the standalone image carries no Prisma CLI).

## Cutover

Vercel Cron and the scheduler must not both run — the jobs send email.

1. Deploy `cron` with no `CRON_SECRET` first (every call answers 401, nothing runs) and check the
   logs show the lines firing.
2. Move DNS to Railway, set the real `CRON_SECRET` on `cron`, then delete `apps/web/vercel.json`
   (its rewrite now lives in `next.config.ts`) and the Vercel project.
3. Update `BETTER_AUTH_URL`, the Microsoft Entra redirect URIs, and `GRAPH_NOTIFICATION_URL` if the
   origin changed.

## Still on Vercel

`apps/landing` and `LANDING_DEPLOY_HOOK_URL` (the careers rebuild hook) are untouched. Railway has no
deploy-hook URL, so moving landing means replacing that hook with a Railway API call.
