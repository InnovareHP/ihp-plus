# SharePoint document sync — setup

The portal mirrors staff-authored documents from an internal SharePoint library into a client
library and shares client folders with guests. Nothing in `apps/web` reads a SharePoint value
from the database: the app is configured by `GRAPH_*` in `.env` (see `.env.example`).

Run `pnpm graph:check` at any point. It prints which step fails and why, so a wrong value and a
missing grant never look alike. A 401 means no permission is consented; a 403 means consent
landed but the site grant has not.

Verified against a live tenant on 2026-09-17: `Sites.Selected` **does** carry sharing calls,
which Microsoft's own reference does not say — `createLink` succeeds under it. The guest
`invite` path is still unproven until a real address is shared with.

## What a developer can do

1. **Register a second app** at [entra.microsoft.com](https://entra.microsoft.com) →
   App registrations → New registration. Single tenant, no redirect URI. This is _not_ the
   Better Auth sign-in app: sharing `MICROSOFT_CLIENT_ID` would put tenant-wide file write
   behind the same secret as sign-in, and a broad delegated scope on that app cancels out
   `Sites.Selected`.
2. Copy **Application (client) ID** → `GRAPH_CLIENT_ID` and **Directory (tenant) ID** →
   `GRAPH_TENANT_ID`. The tenant value must be the GUID; `common` is rejected on purpose.
3. **Certificates & secrets → New client secret** → `GRAPH_CLIENT_SECRET`. Fine for
   development. Production uses `GRAPH_CLIENT_CERT_PRIVATE_KEY` +
   `GRAPH_CLIENT_CERT_THUMBPRINT`, because a secret expires at 24 months and the mirror stops
   without saying why.
4. Generate `GRAPH_CRON_SECRET` (`openssl rand -hex 32`). It is the bearer token for
   `POST /app/api/graph/renew`, which an external scheduler calls daily — a drive subscription
   lapses after 4230 minutes and this repo has no worker process.

## What only a tenant admin can do

Steps 1–4 above leave the app able to get a token and nothing else. `pnpm graph:check` stops at
the first of these that is missing.

1. **Two sites**, if they do not exist: one internal (staff sync this one), one for client
   folders. They must be separate sites — a `Sites.Selected` grant is per site collection,
   there is no folder-level grant, so one site cannot be both staff-only and client-facing.
   Make them **Communication sites**: a Team site drags a Microsoft 365 group behind it — a
   mailbox, calendar, Planner and a Teams hook nobody uses for a document library.
2. **Admin consent** on the app's API permissions → Microsoft Graph → Application permissions:
   - `Sites.Selected` — the least-privilege file permission
   - `User.Invite.All` — app-only access cannot invite a _new_ guest to a drive item, so the
     portal creates the B2B guest first and shares with them second

   Grant nothing broader. `Sites.ReadWrite.All` or a `Files.*.All` beside it makes the per-site
   grant meaningless.

3. **Grant the app write on each site.** `Sites.Selected` grants nothing by itself. The grant
   call needs `Sites.FullControl.All`, which the daemon deliberately lacks, so it runs as an
   admin instead:

   ```bash
   pnpm graph:grant                                    # sites already in .env
   pnpm graph:grant <internal site URL> <client site URL>   # fresh sites, prints the drive ids
   ```

   It prints a device code, an admin signs in once in a browser, and it then reads each
   library's site from the drive id in `.env` and grants `write` on both. PnP PowerShell does
   the same thing (`Grant-PnPAzureADAppSitePermission`) but needs PowerShell 7 and its own
   `-ClientId` since Microsoft retired the shared PnP app.

4. **External sharing on the client site**: SharePoint admin centre → Sites → Active sites →
   the client site → Sharing → **New and existing guests**. Without it every invite fails per
   recipient, and the portal shows Microsoft's own wording back to the user.

## Then the drive ids

With the grants in place, `pnpm graph:sites` lists each site and its libraries with the ids to
paste. Take the **Documents** library of each:

```
GRAPH_INTERNAL_DRIVE_ID=<internal site's Documents drive>
GRAPH_CLIENT_DRIVE_ID=<client site's Documents drive>
```

If `Sites.Selected` refuses the listing, read the ids without Graph — signed in to SharePoint,
`/_api/site/id` and `/_api/web/id` on the site return two GUIDs, and the Graph site id is
`<tenant>.sharepoint.com,<site id>,<web id>`. The hostname is the SharePoint tenant
(`<tenant>.sharepoint.com`), never the mail domain.

Restart `pnpm dev` after editing `.env`; turbo does not reload env into a running process.

## How staff use it

One rule, and it is a folder rather than a metadata column, because the OneDrive sync client
shows folders in Explorer and SharePoint columns nowhere:

```
Clients/<client name>/Shared/   → mirrored to the client library, visible to invited guests
Clients/<client name>/...       → internal
Bluebook/...                    → internal; where the portal files bluebook uploads
```

`<client name>` must match a client in the portal's CRM, or the sweep copies nothing and says
so. Sharing itself is done in the portal: a client's row → **Folder access**. Every grant the
organization has made is listed on `/app/folder-access`, admin only.
