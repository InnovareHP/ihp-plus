# RPC — gRPC for the web portal

The portal (`apps/web`) talks to backend services over **gRPC**. No hand-written
REST controllers, no ad-hoc `fetch` to a JSON endpoint, no client-side schema
guessing. The `.proto` file is the contract and the only source of truth.

**Nothing is installed yet** — no proto, no backend service, no codegen. The first
task that needs a service sets this up; until then `apps/web/src/app/api/health/route.ts`
stays the only HTTP handler.

## The browser constraint (read before choosing a library)

A browser cannot speak native gRPC — it needs HTTP/2 trailers no fetch API exposes.
Two ways out, and the choice is already made:

**Use Connect (`@connectrpc/connect`, `@connectrpc/connect-web`).** One handler
serves the Connect, gRPC-Web, and native gRPC protocols, so the browser and a
server-to-server caller hit the same service with no Envoy sidecar and no
translation layer. Plain `grpc-web` + Envoy is the alternative and is rejected here
— it adds a proxy to `infra/` for no gain.

If native gRPC between backend services is ever needed, that traffic bypasses the
nginx proxy in `infra/docker/nginx/proxy.conf`; adding it means `grpc_pass` and
HTTP/2 there, which is a deliberate infra change, not a drive-by edit.

## Layout

```
packages/proto/    .proto files, buf.yaml, buf.gen.yaml — the contract
packages/rpc/      generated TS clients + shared transport (@ihp/rpc)
```

- Generate with `buf generate` via `protoc-gen-es` / `protoc-gen-connect-es`.
  Generated output is **committed** so installs and Docker builds need no codegen
  step, and it is never hand-edited.
- Adding either package means the four-place wiring in
  `.claude/rules/monorepo-wiring.md` — both Dockerfile COPY lists included.
- Proto style: one service per file, `package ihp.<domain>.v1`, versioned from day
  one. Field numbers are permanent; add fields, never renumber or reuse.

## Client usage

- One transport per environment, created once in `@ihp/rpc`, not per call:
  `createConnectTransport({ baseUrl })` — browser transport for client components,
  a server-side transport for RSC and route handlers.
- Browser calls go through the existing single origin (`/app/...`), so no CORS.
- **Wrap every call in TanStack Query** (`.claude/rules/frontend-patterns.md`) —
  `useQuery` for reads, `useMutation` for writes; prefer `@connectrpc/connect-query`
  so query keys derive from the method descriptor. Never call a client method from
  a `useEffect`.
- Read-once data belongs in a server component calling the service directly.

## Errors and auth

- Service errors are `ConnectError` with a proper `Code` (`invalid_argument`,
  `not_found`, `permission_denied`, `unauthenticated`) — never a 200 with an error
  field.
- Map `ConnectError` to form state via `setError`, and to a live region for
  announcement (`.claude/rules/accessibility.md`).
- Auth travels in request metadata through a transport interceptor, defined once —
  never passed as a per-call argument.
- Validation lives on the server; the client's zod schema mirrors the proto for UX
  only and is not the trust boundary.

## Testing

Generated clients make services mockable at the interface — see
`.claude/rules/testing.md`. Test against the generated client type, never a
hand-written response shape.
