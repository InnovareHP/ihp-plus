import { createConnectTransport } from '@connectrpc/connect-web'

// One transport per environment, created once here rather than per call. The browser talks
// to the app's own origin, which is why there is no CORS config anywhere in this repo.
export const browserTransport = createConnectTransport({ baseUrl: '/app/api/rpc' })
