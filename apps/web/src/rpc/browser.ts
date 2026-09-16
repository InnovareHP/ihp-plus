import { browserTransport, createClient } from '@ihp/rpc'
import { ContractsService } from '@ihp/rpc/contracts'
import { DirectoryService } from '@ihp/rpc/directory'
import { EvaluationsService } from '@ihp/rpc/evaluations'
import { LookupsService } from '@ihp/rpc/lookups'
import { MembersService } from '@ihp/rpc/members'
import { RequestsService } from '@ihp/rpc/requests'

// Only the generated contract and the transport, so none of the server graph follows it
// into the client bundle.
export const browserClients = {
  contracts: createClient(ContractsService, browserTransport),
  directory: createClient(DirectoryService, browserTransport),
  evaluations: createClient(EvaluationsService, browserTransport),
  lookups: createClient(LookupsService, browserTransport),
  members: createClient(MembersService, browserTransport),
  requests: createClient(RequestsService, browserTransport),
}
