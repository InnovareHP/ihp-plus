import { createClient, createRouterTransport } from '@ihp/rpc'
import { ContractsService } from '@ihp/rpc/contracts'
import { LookupsService } from '@ihp/rpc/lookups'
import { MembersService } from '@ihp/rpc/members'
import { RequestsService } from '@ihp/rpc/requests'
import { registerRoutes } from './routes'

// Dispatches straight into the implementations, so a server component pays no network hop
// and no serialization round trip to its own process. Built once, not per call.
const transport = createRouterTransport(registerRoutes)

// Server-only: this module reaches the service implementations, and through them Prisma and
// next/headers. Client components import ./browser instead.
export const serverClients = {
  contracts: createClient(ContractsService, transport),
  lookups: createClient(LookupsService, transport),
  members: createClient(MembersService, transport),
  requests: createClient(RequestsService, transport),
}
