import { browserTransport, createClient } from '@ihp/rpc'
import { MembersService } from '@ihp/rpc/members'
import { RequestsService } from '@ihp/rpc/requests'

// Only the generated contract and the transport, so none of the server graph follows it
// into the client bundle.
export const browserClients = {
  members: createClient(MembersService, browserTransport),
  requests: createClient(RequestsService, browserTransport),
}
