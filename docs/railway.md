# Moving from Vercel to Railway

Railway project **ihp-plus** (workspace InnovareHP), environment `production`, region
`asia-southeast1`. Every service builds from the repo root (root directory `/`) — a subfolder root
cannot see the pnpm lockfile, and Railpack then falls back to `npm install` and fails.

| Service                | App            | Settings                                                                               | Railway domain                                            |
| ---------------------- | -------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `ihp-plus`             | `apps/web`     | `infra/docker/web.Dockerfile`, healthcheck `/app/api/health`, `PORT=3000`              | `ihp-plus-production.up.railway.app`                      |
| `resilient-friendship` | `apps/landing` | `infra/docker/landing.Dockerfile`, healthcheck `/`, `PORT=80`                          | `resilient-friendship-production-f8ffd546.up.railway.app` |
| `cron`                 | scheduler      | `infra/docker/cron.Dockerfile`, restart always, `WEB_URL` → `ihp-plus`'s public domain | none                                                      |

Railway's own cron jobs allow one schedule per service and expect the process to exit, so the 15
Vercel crons live in one always-on `crond` container instead. Each run logs
`<time> <path> -> <status>` to the `cron` service's logs.

## Build-time variables

A Dockerfile build only sees variables its `ARG` lines name:

- `ihp-plus`: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`.
- `resilient-friendship`: `PORTAL_URL` (the portal origin), `PUBLIC_TURNSTILE_SITE_KEY`.

## Remaining setup

1. Run migrations from a machine with the production `DATABASE_URL`: `pnpm db:migrate` (unchanged
   from Vercel — the standalone image carries no Prisma CLI).
2. Until DNS moves, test on the Railway domains with `BETTER_AUTH_URL` and `PORTAL_URL` set to them.

## Cutover

Vercel Cron and the scheduler must not both run — the jobs send email.

1. Leave `CRON_SECRET` off `cron` at first: every call answers 401, nothing runs, and the logs
   show the schedule firing.
2. Add the custom domains and move DNS, set `CRON_SECRET` on `ihp-plus` and
   `CRON_SECRET=${{ihp-plus.CRON_SECRET}}` on `cron`, then delete `apps/web/vercel.json` (its
   rewrite is now a redirect in `next.config.ts`) and the Vercel projects. If Entra rejects the
   redirect when re-verifying the publisher domain, serve the file from the landing service.
3. Update `BETTER_AUTH_URL`, the Microsoft Entra redirect URIs, and `GRAPH_NOTIFICATION_URL` if the
   origin changed.
4. `LANDING_DEPLOY_HOOK_URL` is a Vercel deploy hook; Railway has none, so the careers page only
   refreshes on the next landing deploy until that call is replaced with Railway's API.
