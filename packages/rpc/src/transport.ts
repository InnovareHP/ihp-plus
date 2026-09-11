import { createConnectTransport } from '@connectrpc/connect-web'

const RPC_PATH = '/app/api/rpc'

// A browser resolves a relative baseUrl against the page, but Node's fetch — which jsdom uses
// under the test runner — rejects one outright, so the origin is put back when there is one.
function baseUrl() {
  return typeof window === 'undefined'
    ? RPC_PATH
    : new URL(RPC_PATH, window.location.origin).toString()
}

// One transport per environment, created once here rather than per call. The browser talks
// to the app's own origin, which is why there is no CORS config anywhere in this repo.
export const browserTransport = createConnectTransport({ baseUrl: baseUrl() })
