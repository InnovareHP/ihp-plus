export { browserTransport } from './transport'

// Re-exported so no consumer needs a direct dependency on the Connect packages.
export { createConnectTransport } from '@connectrpc/connect-web'
export { createFetchRouter, type FetchRouter, type RegisterRoutes } from './fetch-router'

// Re-exported so call sites map service errors without depending on Connect directly.
export { Code, ConnectError, createClient, createRouterTransport } from '@connectrpc/connect'
export type { Client, ConnectRouter, ServiceImpl, Transport } from '@connectrpc/connect'
